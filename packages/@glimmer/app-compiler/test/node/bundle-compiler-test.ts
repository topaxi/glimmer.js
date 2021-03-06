import { module, test } from 'qunitjs';
import { GlimmerBundleCompiler } from '@glimmer/app-compiler';
import { createTempDir, buildOutput } from 'broccoli-test-helper';
import co from 'co';
import { ModuleUnificationCompilerDelegate } from '@glimmer/compiler-delegates';

class TestModuleUnificationDelegate extends ModuleUnificationCompilerDelegate {
  normalizePath(modulePath: string): string {
    return modulePath.replace('my-app/', '');
  }
}

module('Broccol Glimmer Bundle Compiler', function(hooks) {
  let input = null;

  hooks.beforeEach(() => createTempDir().then(tempDir => (input = tempDir)));

  hooks.afterEach(() => {
    input.dispose();
  });

  test('requires a mode or delegate', function (assert) {
    assert.throws(() => {
      new GlimmerBundleCompiler(input.path(), { projectPath: 'src' });
    }, /Must pass a bundle compiler mode or pass a custom compiler delegate\./);
  });

  test('requires a project path', function (assert) {
    assert.throws(() => {
      new GlimmerBundleCompiler(input.path(), {
        mode: 'module-unification'
      });
    }, /Must supply a projectPath/);
  });

  test('syncs forward all files', co.wrap(function *(assert) {
    input.write({
      'my-app': {
        'package.json': JSON.stringify({name: 'my-app'}),
        src: {
          ui: {
            components: {
              A: {
                'template.hbs': '<div>Hello</div>',
                'component.ts': 'export default class A {}'
              },

              B: {
                'template.hbs': 'From B: <A @foo={{bar}} /> {{@bar}}',
                'component.ts': 'export default class B {}'
              },

              C: {
                'template.hbs': 'From C',
                'component.ts': 'export default class C {}'
              },

              D: {
                'template.hbs': '{{component C}}',
                'component.ts': 'export default class D {}'
              }
            }
          }
        }
      }
    });

    let compiler = new GlimmerBundleCompiler(input.path(), {
      projectPath: `${input.path()}/my-app`,
      delegate: TestModuleUnificationDelegate,
      outputFiles: {
        dataSegment: 'my-app/src/data.js',
        heapFile: 'my-app/src/templates.gbx'
      }
    });

    let output = yield buildOutput(compiler);
    let files = output.read();

    assert.deepEqual(Object.keys(files), ['my-app']);
    assert.deepEqual(Object.keys(files['my-app']).sort(), ['src', 'package.json'].sort());
    assert.deepEqual(Object.keys(files['my-app'].src).sort(), ['ui', 'templates.gbx', 'data.js'].sort());
    assert.deepEqual(Object.keys(files['my-app'].src.ui), ['components']);

    Object.keys(files['my-app'].src.ui.components).forEach((component) => {
      assert.deepEqual(Object.keys(files['my-app'].src.ui.components[component]), ['component.ts']);
    });
  }));

  test('[MU] compiles the gbx and data segment', co.wrap(function *(assert) {
    input.write({
      'my-app': {
        'package.json': JSON.stringify({name: 'my-app'}),
        src: {
          ui: {
            components: {
              A: {
                'template.hbs': '<div>Hello</div>'
              },

              B: {
                'template.hbs': 'From B: <A @foo={{bar}} /> {{@bar}}'
              },

              C: {
                'template.hbs': 'From C'
              },

              D: {
                'template.hbs': '{{component C}}'
              }
            }
          }
        }
      }
    });

    let compiler = new GlimmerBundleCompiler(input.path(), {
      projectPath: `${input.path()}/my-app`,
      delegate: TestModuleUnificationDelegate,
      outputFiles: {
        dataSegment: 'my-app/src/data.js',
        heapFile: 'my-app/src/templates.gbx'
      }
    });

    let output = yield buildOutput(compiler);
    let files = output.read();

    let buffer = new Uint16Array(files['my-app'].src['templates.gbx']);

    assert.ok(buffer, 'Buffer is aligned');
  }));
});

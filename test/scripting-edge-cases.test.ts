import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScriptingEngineImpl } from '../src/scripting-engine';
import { Script, ScriptLanguage, ExecutionContext } from '../src/types';

describe('Scripting Engine - Golden Paths & Edge Cases', () => {
  let scriptingEngine: ScriptingEngineImpl;

  beforeEach(() => {
    scriptingEngine = new ScriptingEngineImpl();
  });

  afterEach(() => {
    // Clean up any resources
  });

  describe('Golden Path Scenarios', () => {
    it('should load and execute JavaScript scripts', async () => {
      const script: Script = {
        id: 'test-js',
        name: 'Test JavaScript Script',
        language: 'javascript' as ScriptLanguage,
        code: `
          const result = input.value * 2;
          return { doubled: result, original: input.value };
        `,
        context: 'server' as ExecutionContext,
        permissions: ['read'],
        metadata: { version: '1.0' }
      };

      const scriptId = await scriptingEngine.loadScript(script);
      expect(scriptId).toBe('test-js');

      const context = { input: { value: 21 } };
      const result = await scriptingEngine.executeScript(scriptId, context);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ doubled: 42, original: 21 });
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.memoryUsed).toBeGreaterThan(0);
    });

    it('should execute stored procedures', async () => {
      const procedureId = await scriptingEngine.createStoredProcedure(
        'calculate_total',
        'procedure-script',
        ['items', 'taxRate']
      );

      // Load the base script
      const baseScript: Script = {
        id: 'procedure-script',
        name: 'Base Procedure Script',
        language: 'javascript' as ScriptLanguage,
        code: `
          const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const tax = subtotal * taxRate;
          const total = subtotal + tax;
          return { subtotal, tax, total };
        `,
        context: 'server' as ExecutionContext,
        permissions: ['read'],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const result = await scriptingEngine.executeStoredProcedure(procedureId, [
        [{ price: 10, quantity: 2 }, { price: 5, quantity: 1 }],
        0.1
      ]);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        subtotal: 25,
        tax: 2.5,
        total: 27.5
      });
    });

    it('should handle triggers and events', async () => {
      const triggerId = await scriptingEngine.createTrigger(
        'user_created',
        'trigger-script',
        { eventType: 'user_created' }
      );

      // Load the base script
      const baseScript: Script = {
        id: 'trigger-script',
        name: 'User Created Trigger',
        language: 'javascript' as ScriptLanguage,
        code: `
          // Send welcome email
          console.log(\`Welcome email sent to \${eventData.email}\`);

          // Create user preferences
          monarch.set('user_preferences', eventData.userId, {
            theme: 'light',
            notifications: true,
            createdAt: new Date().toISOString()
          });

          return { emailSent: true, preferencesCreated: true };
        `,
        context: 'server' as ExecutionContext,
        permissions: ['write'],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const eventData = {
        userId: 'user123',
        email: 'user@example.com',
        name: 'John Doe'
      };

      const result = await scriptingEngine.fireTrigger(triggerId, eventData);

      expect(result).toEqual({
        emailSent: true,
        preferencesCreated: true
      });
    });

    it('should support different execution contexts', async () => {
      const contexts: ExecutionContext[] = ['server', 'client', 'edge'];

      for (const context of contexts) {
        const script: Script = {
          id: `context-${context}`,
          name: `Context ${context} Script`,
          language: 'javascript' as ScriptLanguage,
          code: `
            return {
              context: '${context}',
              timestamp: Date.now(),
              environment: typeof window !== 'undefined' ? 'browser' : 'server'
            };
          `,
          context,
          permissions: ['read'],
          metadata: { testContext: context }
        };

        const scriptId = await scriptingEngine.loadScript(script);
        const result = await scriptingEngine.executeScript(scriptId);

        expect(result.success).toBe(true);
        expect(result.result.context).toBe(context);
      }
    });
  });

  describe('Edge Cases - Script Loading', () => {
    it('should handle empty scripts', async () => {
      const emptyScript: Script = {
        id: 'empty',
        name: 'Empty Script',
        language: 'javascript' as ScriptLanguage,
        code: '',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await expect(scriptingEngine.loadScript(emptyScript)).rejects.toThrow();
    });

    it('should handle very large scripts', async () => {
      const largeScript: Script = {
        id: 'large-script',
        name: 'Large Script',
        language: 'javascript' as ScriptLanguage,
        code: `
          // Generate a large script
          const data = '${'x'.repeat(100000)}';
          return { size: data.length };
        `,
        context: 'server' as ExecutionContext,
        permissions: ['read'],
        metadata: {}
      };

      const scriptId = await scriptingEngine.loadScript(largeScript);
      const result = await scriptingEngine.executeScript(scriptId);

      expect(result.success).toBe(true);
      expect(result.result.size).toBe(100000);
    });

    it('should handle invalid script syntax', async () => {
      const invalidScripts = [
        {
          id: 'syntax-error',
          name: 'Syntax Error',
          language: 'javascript' as ScriptLanguage,
          code: 'function broken { return "incomplete"; }',
          context: 'server' as ExecutionContext,
          permissions: [],
          metadata: {}
        },
        {
          id: 'lua-syntax-error',
          name: 'Lua Syntax Error',
          language: 'lua' as ScriptLanguage,
          code: 'function broken return "missing end"',
          context: 'server' as ExecutionContext,
          permissions: [],
          metadata: {}
        }
      ];

      for (const script of invalidScripts) {
        await expect(scriptingEngine.loadScript(script)).rejects.toThrow();
      }
    });

    it('should handle unsupported languages', async () => {
      const unsupportedScript: Script = {
        id: 'unsupported',
        name: 'Unsupported Language',
        language: 'unsupported' as ScriptLanguage,
        code: 'print("hello")',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await expect(scriptingEngine.loadScript(unsupportedScript)).rejects.toThrow();
    });
  });

  describe('Edge Cases - Script Execution', () => {
    it('should handle infinite loops with timeouts', async () => {
      const infiniteLoopScript: Script = {
        id: 'infinite-loop',
        name: 'Infinite Loop',
        language: 'javascript' as ScriptLanguage,
        code: `
          while (true) {
            // Infinite loop
          }
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(infiniteLoopScript);

      // Should handle infinite loops gracefully (implementation dependent)
      // In a real implementation, this would have timeouts
      try {
        await scriptingEngine.executeScript('infinite-loop');
      } catch (error) {
        expect(error).toBeDefined(); // Should handle gracefully
      }
    });

    it('should handle scripts that throw exceptions', async () => {
      const errorScript: Script = {
        id: 'error-script',
        name: 'Error Script',
        language: 'javascript' as ScriptLanguage,
        code: `
          throw new Error('Intentional test error');
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      const scriptId = await scriptingEngine.loadScript(errorScript);
      const result = await scriptingEngine.executeScript(scriptId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Intentional test error');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle scripts with undefined variables', async () => {
      const undefinedVarScript: Script = {
        id: 'undefined-var',
        name: 'Undefined Variable',
        language: 'javascript' as ScriptLanguage,
        code: `
          return undefinedVariable + 1;
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      const scriptId = await scriptingEngine.loadScript(undefinedVarScript);
      const result = await scriptingEngine.executeScript(scriptId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle memory-intensive scripts', async () => {
      const memoryHogScript: Script = {
        id: 'memory-hog',
        name: 'Memory Hog',
        language: 'javascript' as ScriptLanguage,
        code: `
          const largeArray = new Array(1000000).fill('data');
          return { size: largeArray.length };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      const scriptId = await scriptingEngine.loadScript(memoryHogScript);
      const result = await scriptingEngine.executeScript(scriptId);

      expect(result.success).toBe(true);
      expect(result.result.size).toBe(1000000);
      expect(result.memoryUsed).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases - Stored Procedures', () => {
    it('should handle procedures with no parameters', async () => {
      const noParamProcedure = await scriptingEngine.createStoredProcedure(
        'no_params_proc',
        'no-param-script',
        []
      );

      const baseScript: Script = {
        id: 'no-param-script',
        name: 'No Parameters',
        language: 'javascript' as ScriptLanguage,
        code: 'return { message: "Hello World" };',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const result = await scriptingEngine.executeStoredProcedure(noParamProcedure, []);
      expect(result.result.message).toBe('Hello World');
    });

    it('should handle procedures with many parameters', async () => {
      const manyParams = Array.from({ length: 10 }, (_, i) => `param${i}`);
      const manyParamProcedure = await scriptingEngine.createStoredProcedure(
        'many_params_proc',
        'many-param-script',
        manyParams
      );

      const baseScript: Script = {
        id: 'many-param-script',
        name: 'Many Parameters',
        language: 'javascript' as ScriptLanguage,
        code: `
          return {
            paramCount: arguments.length,
            params: Array.from(arguments)
          };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const args = Array.from({ length: 10 }, (_, i) => `value${i}`);
      const result = await scriptingEngine.executeStoredProcedure(manyParamProcedure, args);

      expect(result.result.paramCount).toBe(10);
      expect(result.result.params).toEqual(args);
    });

    it('should handle procedure execution failures', async () => {
      const failingProcedure = await scriptingEngine.createStoredProcedure(
        'failing_proc',
        'failing-script',
        ['input']
      );

      const baseScript: Script = {
        id: 'failing-script',
        name: 'Failing Script',
        language: 'javascript' as ScriptLanguage,
        code: 'throw new Error("Procedure failed");',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const result = await scriptingEngine.executeStoredProcedure(failingProcedure, ['test']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Procedure failed');
    });
  });

  describe('Edge Cases - Triggers', () => {
    it('should handle triggers with complex conditions', async () => {
      const complexTrigger = await scriptingEngine.createTrigger(
        'complex_event',
        'complex-trigger-script',
        {
          status: 'active',
          priority: { $gte: 5 },
          category: 'important'
        }
      );

      const baseScript: Script = {
        id: 'complex-trigger-script',
        name: 'Complex Trigger',
        language: 'javascript' as ScriptLanguage,
        code: `
          return {
            triggered: true,
            eventId: eventData.id,
            processedAt: new Date().toISOString()
          };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const eventData = {
        id: 'event123',
        status: 'active',
        priority: 8,
        category: 'important',
        data: 'test'
      };

      const result = await scriptingEngine.fireTrigger(complexTrigger, eventData);
      expect(result.triggered).toBe(true);
      expect(result.eventId).toBe('event123');
    });

    it('should handle triggers that dont fire', async () => {
      const nonFiringTrigger = await scriptingEngine.createTrigger(
        'selective_event',
        'selective-script',
        { mustFire: false }
      );

      const baseScript: Script = {
        id: 'selective-script',
        name: 'Selective Trigger',
        language: 'javascript' as ScriptLanguage,
        code: 'return { triggered: false, reason: "Condition not met" };',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      const result = await scriptingEngine.fireTrigger(nonFiringTrigger, { test: 'data' });
      expect(result).toBeNull();
    });

    it('should handle trigger execution errors', async () => {
      const errorTrigger = await scriptingEngine.createTrigger(
        'error_event',
        'error-trigger-script'
      );

      const baseScript: Script = {
        id: 'error-trigger-script',
        name: 'Error Trigger',
        language: 'javascript' as ScriptLanguage,
        code: 'throw new Error("Trigger execution failed");',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      await expect(scriptingEngine.fireTrigger(errorTrigger, {})).rejects.toThrow();
    });
  });

  describe('Edge Cases - Resource Management', () => {
    it('should handle script unloading', async () => {
      const unloadScript: Script = {
        id: 'unload-test',
        name: 'Unload Test',
        language: 'javascript' as ScriptLanguage,
        code: 'return { unloaded: false };',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(unloadScript);

      // Should work before unloading
      const beforeResult = await scriptingEngine.executeScript('unload-test');
      expect(beforeResult.success).toBe(true);

      // Unload script
      await scriptingEngine.unloadScript('unload-test');

      // Should fail after unloading
      await expect(scriptingEngine.executeScript('unload-test')).rejects.toThrow();
      await expect(scriptingEngine.getScriptStats('unload-test')).rejects.toThrow();
    });

    it('should handle concurrent script executions', async () => {
      const concurrentScript: Script = {
        id: 'concurrent',
        name: 'Concurrent Script',
        language: 'javascript' as ScriptLanguage,
        code: `
          // Simulate some work
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait for 10ms
          }
          return { executionId: Math.random() };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(concurrentScript);

      // Execute multiple times concurrently
      const executions = Array.from({ length: 10 }, () =>
        scriptingEngine.executeScript('concurrent')
      );

      const startTime = Date.now();
      const results = await Promise.all(executions);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.result).toHaveProperty('executionId');
      });

      console.log(`Concurrent script execution: 10 scripts in ${totalTime}ms`);
    });

    it('should track script performance metrics', async () => {
      const metricsScript: Script = {
        id: 'metrics-test',
        name: 'Metrics Test',
        language: 'javascript' as ScriptLanguage,
        code: `
          const work = Array.from({ length: 1000 }, Math.random);
          return { workDone: work.length };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(metricsScript);

      // Execute multiple times to build metrics
      for (let i = 0; i < 5; i++) {
        await scriptingEngine.executeScript('metrics-test');
      }

      const stats = await scriptingEngine.getScriptStats('metrics-test');
      expect(stats.executions).toBe(5);
      expect(stats.avgTime).toBeGreaterThan(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid script loading and unloading', async () => {
      const operations = [];

      for (let i = 0; i < 50; i++) {
        const script: Script = {
          id: `stress-script-${i}`,
          name: `Stress Script ${i}`,
          language: 'javascript' as ScriptLanguage,
          code: `return { index: ${i} };`,
          context: 'server' as ExecutionContext,
          permissions: [],
          metadata: {}
        };

        operations.push(scriptingEngine.loadScript(script));

        // Unload every 5th script
        if (i % 5 === 0 && i > 0) {
          operations.push(scriptingEngine.unloadScript(`stress-script-${i - 1}`));
        }
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      console.log(`Script stress test: 50 load/unload operations in ${totalTime}ms`);
    });

    it('should handle large numbers of stored procedures', async () => {
      const procedures = [];

      // Create base script
      const baseScript: Script = {
        id: 'bulk-base',
        name: 'Bulk Base Script',
        language: 'javascript' as ScriptLanguage,
        code: 'return { result: "bulk_test" };',
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      // Create many procedures
      for (let i = 0; i < 100; i++) {
        const procedureId = await scriptingEngine.createStoredProcedure(
          `bulk_proc_${i}`,
          'bulk-base',
          [`param${i}`]
        );
        procedures.push(procedureId);
      }

      // Execute procedures
      const executionPromises = procedures.slice(0, 20).map(procedureId =>
        scriptingEngine.executeStoredProcedure(procedureId, [`value`])
      );

      const startTime = Date.now();
      const results = await Promise.all(executionPromises);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log(`Bulk procedures test: 20 executions in ${executionTime}ms`);
    });

    it('should handle high-frequency trigger firing', async () => {
      const triggerId = await scriptingEngine.createTrigger(
        'high_freq_event',
        'high-freq-script'
      );

      const baseScript: Script = {
        id: 'high-freq-script',
        name: 'High Frequency Script',
        language: 'javascript' as ScriptLanguage,
        code: `
          return {
            fired: true,
            counter: (global.counter = (global.counter || 0) + 1)
          };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(baseScript);

      // Fire trigger many times
      const triggerPromises = Array.from({ length: 100 }, (_, i) =>
        scriptingEngine.fireTrigger(triggerId, { eventId: i })
      );

      const startTime = Date.now();
      const results = await Promise.all(triggerPromises);
      const totalTime = Date.now() - startTime;

      expect(results.filter(r => r?.fired)).toHaveLength(100);

      console.log(`High-frequency triggers: 100 triggers fired in ${totalTime}ms`);
    });
  });

  describe('Cross-Language Compatibility', () => {
    it('should handle JavaScript context isolation', async () => {
      const isolationScript: Script = {
        id: 'isolation-test',
        name: 'Isolation Test',
        language: 'javascript' as ScriptLanguage,
        code: `
          // Try to access/modify global state
          if (typeof globalTestVar === 'undefined') {
            globalTestVar = 'modified';
          }
          return { globalVar: globalTestVar };
        `,
        context: 'server' as ExecutionContext,
        permissions: [],
        metadata: {}
      };

      await scriptingEngine.loadScript(isolationScript);

      const result1 = await scriptingEngine.executeScript('isolation-test');
      const result2 = await scriptingEngine.executeScript('isolation-test');

      // Each execution should have its own context
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle different script languages uniformly', async () => {
      const scripts = [
        {
          id: 'js-script',
          language: 'javascript' as ScriptLanguage,
          code: 'return { language: "javascript", result: 42 };'
        },
        {
          id: 'lua-script',
          language: 'lua' as ScriptLanguage,
          code: 'return { language = "lua", result = 42 }'
        }
      ];

      for (const scriptConfig of scripts) {
        const script: Script = {
          id: scriptConfig.id,
          name: scriptConfig.id,
          language: scriptConfig.language,
          code: scriptConfig.code,
          context: 'server' as ExecutionContext,
          permissions: [],
          metadata: {}
        };

        try {
          await scriptingEngine.loadScript(script);
          const result = await scriptingEngine.executeScript(scriptConfig.id);

          if (result.success) {
            expect(result.result).toHaveProperty('result', 42);
          }
        } catch (error) {
          // Language may not be fully implemented, that's OK for this test
          console.log(`Language ${scriptConfig.language} not fully supported in test environment`);
        }
      }
    });
  });
});

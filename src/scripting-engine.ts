import { ScriptingEngine, Script, ScriptExecutionResult, ScriptLanguage, ExecutionContext } from './types';
import { logger } from './logger';

export class ScriptingEngineImpl implements ScriptingEngine {
  private scripts = new Map<string, Script>();
  private scriptStats = new Map<string, { executions: number; avgTime: number; errors: number; lastExecuted: number }>();
  private luaRuntime: any = null; // Would be a real Lua runtime in production
  private wasmInstances = new Map<string, WebAssembly.Instance>();

  async loadScript(script: Script): Promise<string> {
    const scriptId = script.id;

    // Validate script
    if (!script.code || script.code.trim().length === 0) {
      throw new Error('Script code cannot be empty');
    }

    // Validate language support
    if (!['lua', 'javascript', 'wasm'].includes(script.language)) {
      throw new Error(`Unsupported script language: ${script.language}`);
    }

    // Pre-compile/validate script based on language
    await this.validateScript(script);

    // Store script
    this.scripts.set(scriptId, script);

    // Initialize stats
    this.scriptStats.set(scriptId, {
      executions: 0,
      avgTime: 0,
      errors: 0,
      lastExecuted: 0
    });

    logger.info('Script loaded', { scriptId, language: script.language, name: script.name });
    return scriptId;
  }

  async executeScript(scriptId: string, context: Record<string, any>): Promise<ScriptExecutionResult> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    const startTime = Date.now();
    let result: any;
    let error: string | undefined;

    try {
      // Execute based on language
      switch (script.language) {
        case 'javascript':
          result = await this.executeJavaScript(script, context);
          break;
        case 'lua':
          result = await this.executeLua(script, context);
          break;
        case 'wasm':
          result = await this.executeWASM(script, context);
          break;
        default:
          throw new Error(`Unsupported language: ${script.language}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const executionTime = Date.now() - startTime;
    const memoryUsed = this.estimateMemoryUsage(script, context);

    // Update statistics
    const stats = this.scriptStats.get(scriptId)!;
    const newExecutions = stats.executions + 1;
    const newAvgTime = (stats.avgTime * stats.executions + executionTime) / newExecutions;

    this.scriptStats.set(scriptId, {
      executions: newExecutions,
      avgTime: newAvgTime,
      errors: error ? stats.errors + 1 : stats.errors,
      lastExecuted: Date.now()
    });

    return {
      success: !error,
      result,
      error,
      executionTime,
      memoryUsed
    };
  }

  async unloadScript(scriptId: string): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    // Cleanup based on language
    if (script.language === 'wasm') {
      this.wasmInstances.delete(scriptId);
    }

    this.scripts.delete(scriptId);
    this.scriptStats.delete(scriptId);

    logger.info('Script unloaded', { scriptId });
  }

  async getScriptStats(scriptId: string): Promise<{ executions: number; avgTime: number; errors: number }> {
    const stats = this.scriptStats.get(scriptId);
    if (!stats) {
      throw new Error(`Script ${scriptId} not found`);
    }

    return {
      executions: stats.executions,
      avgTime: stats.avgTime,
      errors: stats.errors
    };
  }

  // Language-specific execution methods

  private async executeJavaScript(script: Script, context: Record<string, any>): Promise<any> {
    // Create isolated context
    const scriptContext = {
      ...context,
      console: {
        log: (...args: any[]) => logger.debug(`[Script ${script.id}]`, { args }),
        error: (...args: any[]) => logger.error(`[Script ${script.id}]`, { args }),
        warn: (...args: any[]) => logger.warn(`[Script ${script.id}]`, { args })
      },
      // Add Monarch-specific APIs
      monarch: this.createMonarchAPI(script)
    };

    // Create function from script code
    try {
      const scriptFunction = new Function(...Object.keys(scriptContext), script.code);
      return await scriptFunction(...Object.values(scriptContext));
    } catch (error) {
      throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeLua(script: Script, context: Record<string, any>): Promise<any> {
    if (!this.luaRuntime) {
      // Initialize Lua runtime (mock implementation)
      this.luaRuntime = {
        execute: async (code: string, ctx: any) => {
          logger.debug('Executing Lua script', { scriptId: script.id, contextKeys: Object.keys(ctx) });

          // Mock Lua execution - in reality would use lua.vm or similar
          if (code.includes('return')) {
            return { result: 'lua_executed', context: ctx };
          }
          return null;
        }
      };
    }

    try {
      const luaContext = {
        ...context,
        monarch_api: this.createMonarchAPI(script)
      };

      return await this.luaRuntime.execute(script.code, luaContext);
    } catch (error) {
      throw new Error(`Lua execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeWASM(script: Script, context: Record<string, any>): Promise<any> {
    let instance = this.wasmInstances.get(script.id);

    if (!instance) {
      // Compile and instantiate WASM module
      try {
        const wasmBuffer = Buffer.from(script.code, 'base64'); // Assume base64 encoded
        const wasmModule = await WebAssembly.compile(wasmBuffer);

        // Create import object with Monarch APIs
        const importObject = {
          monarch: this.createMonarchAPI(script),
          env: {
            memory: new WebAssembly.Memory({ initial: 256 }),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
            console_log: (_ptr: number, _len: number) => {
              logger.debug('WASM script log', { scriptId: script.id });
            }
          }
        };

        instance = await WebAssembly.instantiate(wasmModule, importObject);
        this.wasmInstances.set(script.id, instance);
      } catch (error) {
        throw new Error(`WASM compilation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    try {
      // Assume WASM module exports a 'run' function
      const runFunction = instance.exports.run as Function;
      if (!runFunction) {
        throw new Error('WASM module must export a "run" function');
      }

      // Convert context to WASM-compatible format
      const wasmContext = this.serializeContextForWASM(context);
      return runFunction(wasmContext);
    } catch (error) {
      throw new Error(`WASM execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods

  private async validateScript(script: Script): Promise<void> {
    switch (script.language) {
      case 'javascript':
        try {
          new Function(script.code);
        } catch (error) {
          throw new Error(`Invalid JavaScript: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'lua':
        // Basic Lua syntax validation (simplified)
        if (!script.code.includes('return') && !script.code.includes('=')) {
          throw new Error('Invalid Lua script: missing assignment or return statement');
        }
        break;

      case 'wasm':
        // Validate base64 and basic WASM structure
        try {
          const buffer = Buffer.from(script.code, 'base64');
          if (buffer.length < 8) {
            throw new Error('WASM binary too small');
          }
          // Check WASM magic number
          if (buffer.readUInt32LE(0) !== 0x6d736100) {
            throw new Error('Invalid WASM magic number');
          }
        } catch (error) {
          throw new Error(`Invalid WASM binary: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;
    }
  }

  private createMonarchAPI(script: Script): Record<string, any> {
    // Create a safe API for scripts to interact with Monarch
    return {
      // Data access APIs
      get: (collection: string, query: any) => {
        logger.debug('Script database get', { scriptId: script.id, collection });
        return { mock: 'data', collection, query };
      },

      set: (collection: string, data: any) => {
        logger.debug('Script database set', { scriptId: script.id, collection });
        return { success: true, collection, data };
      },

      // Vector operations
      vsearch: (key: string, vector: number[], topK?: number) => {
        logger.debug('Script vector search', { scriptId: script.id, key, topK });
        return Array.from({ length: topK || 5 }, (_, i) => ({
          id: `result_${i}`,
          score: Math.random(),
          metadata: { index: i }
        }));
      },

      // Utility functions
      log: (...args: any[]) => {
        logger.debug(`[Script ${script.id}]`, { args });
      },

      // Context information
      scriptInfo: {
        id: script.id,
        name: script.name,
        language: script.language,
        context: script.context,
        permissions: script.permissions
      }
    };
  }

  private estimateMemoryUsage(script: Script, context: Record<string, any>): number {
    // Rough memory estimation
    const scriptSize = Buffer.byteLength(script.code, 'utf8');
    const contextSize = Buffer.byteLength(JSON.stringify(context), 'utf8');

    // Add overhead for execution
    const overhead = script.language === 'wasm' ? 1024 * 1024 : // 1MB for WASM
                    script.language === 'lua' ? 64 * 1024 :     // 64KB for Lua
                    32 * 1024;                                   // 32KB for JS

    return scriptSize + contextSize + overhead;
  }

  private serializeContextForWASM(context: Record<string, any>): any {
    // Convert context to WASM-compatible format
    // In a real implementation, this would handle memory allocation and pointers
    return {
      data: JSON.stringify(context),
      length: JSON.stringify(context).length
    };
  }

  // Advanced scripting features

  async createStoredProcedure(name: string, scriptId: string, parameters: string[]): Promise<string> {
    const procedureId = `proc_${Date.now()}`;

    const procedureScript: Script = {
      id: procedureId,
      name,
      language: 'javascript', // Stored procedures are JavaScript-based
      code: `
        return async function(${parameters.join(', ')}) {
          const script = await monarch.get('${scriptId}');
          return monarch.executeScript('${scriptId}', { ${parameters.join(', ')} });
        };
      `,
      context: 'server',
      permissions: ['read', 'write'],
      metadata: {
        type: 'stored-procedure',
        baseScript: scriptId,
        parameters
      }
    };

    await this.loadScript(procedureScript);
    logger.info('Created stored procedure', { procedureId, name });
    return procedureId;
  }

  async createTrigger(event: string, scriptId: string, conditions?: Record<string, any>): Promise<string> {
    const triggerId = `trigger_${Date.now()}`;

    const triggerScript: Script = {
      id: triggerId,
      name: `Trigger for ${event}`,
      language: 'javascript',
      code: `
        return async function(eventData) {
          // Check conditions
          ${conditions ? `
          const conditions = ${JSON.stringify(conditions)};
          for (const [key, value] of Object.entries(conditions)) {
            if (eventData[key] !== value) {
              return { triggered: false, reason: 'condition not met' };
            }
          }
          ` : ''}

          // Execute trigger script
          const result = await monarch.executeScript('${scriptId}', eventData);
          return { triggered: true, result };
        };
      `,
      context: 'server',
      permissions: ['read'],
      metadata: {
        type: 'trigger',
        event,
        conditions,
        baseScript: scriptId
      }
    };

    await this.loadScript(triggerScript);
    logger.info('Created trigger', { triggerId, event });
    return triggerId;
  }

  async executeStoredProcedure(procedureId: string, args: any[]): Promise<any> {
    const stats = await this.getScriptStats(procedureId);
    logger.debug('Executing stored procedure', { procedureId, executionCount: stats.executions + 1 });

    const result = await this.executeScript(procedureId, { args });
    return result.result;
  }

  async fireTrigger(triggerId: string, eventData: Record<string, any>): Promise<any> {
    const result = await this.executeScript(triggerId, eventData);

    if (result.success && result.result?.triggered) {
      logger.info('Trigger fired successfully', { triggerId });
      return result.result.result;
    } else {
      logger.debug('Trigger not fired', { triggerId });
      return null;
    }
  }

  // Script management utilities

  getLoadedScripts(): Script[] {
    return Array.from(this.scripts.values());
  }

  getScriptsByLanguage(language: ScriptLanguage): Script[] {
    return this.getLoadedScripts().filter(script => script.language === language);
  }

  getScriptsByContext(context: ExecutionContext): Script[] {
    return this.getLoadedScripts().filter(script => script.context === context);
  }

  async getScriptPerformanceReport(): Promise<Record<string, any>> {
    const report: Record<string, any> = {
      totalScripts: this.scripts.size,
      byLanguage: {},
      byContext: {},
      performance: {}
    };

    // Group by language and context
    for (const script of this.scripts.values()) {
      report.byLanguage[script.language] = (report.byLanguage[script.language] || 0) + 1;
      report.byContext[script.context] = (report.byContext[script.context] || 0) + 1;
    }

    // Performance stats
    for (const [scriptId, stats] of this.scriptStats) {
      const script = this.scripts.get(scriptId);
      if (script) {
        report.performance[script.name] = {
          language: script.language,
          executions: stats.executions,
          avgTime: Math.round(stats.avgTime),
          errors: stats.errors,
          errorRate: stats.executions > 0 ? (stats.errors / stats.executions * 100).toFixed(1) + '%' : '0%'
        };
      }
    }

    return report;
  }
}

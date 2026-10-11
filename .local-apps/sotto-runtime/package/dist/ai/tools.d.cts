import { T as ToolDefinition, a as ProviderRegistry, G as GenerationRequest, b as GenerationEvent } from '../index-BYxnMqfP.cjs';
import 'zod';
import './browser.cjs';

interface ToolContext<Actor> {
    actor: Actor;
    signal: AbortSignal;
    operationId: string;
}
interface PreparedTool {
    effect: 'read' | 'write';
    authorize(): Promise<void>;
    execute(): Promise<string>;
}
interface RuntimeTool<Actor> extends ToolDefinition {
    prepare(input: Record<string, unknown>, context: ToolContext<Actor>): PreparedTool;
}
declare function defineTool<Input, Actor>(definition: ToolDefinition & {
    effect: 'read' | 'write';
    parse(input: unknown): Input;
    authorize(input: Input, context: ToolContext<Actor>): Promise<void>;
    execute(input: Input, context: ToolContext<Actor>): Promise<string>;
}): RuntimeTool<Actor>;
declare class ToolExecutionError extends Error {
    readonly code: 'unknown_tool' | 'invalid_calls' | 'tool_limit' | 'tool_failed' | 'outcome_unknown' | 'completed_result_too_large';
    readonly callId?: string | undefined;
    constructor(code: 'unknown_tool' | 'invalid_calls' | 'tool_limit' | 'tool_failed' | 'outcome_unknown' | 'completed_result_too_large', callId?: string | undefined, options?: ErrorOptions);
}
interface ToolRuntimeOptions<Actor> {
    registry: ProviderRegistry;
    tools: readonly RuntimeTool<Actor>[];
    maxToolRounds?: number;
    maxCalls?: number;
    toolTimeoutMs?: number;
    maxArgumentBytes?: number;
    maxResultBytes?: number;
    finalAnswerOnLimit?: boolean;
    structuredFinalAnswer?: boolean;
}
type ToolRuntimeEvent = GenerationEvent | {
    type: 'tool_status';
    callId: string;
    name: string;
    status: 'running' | 'complete';
} | {
    type: 'tool_limit';
    limit: 'rounds' | 'calls';
};
/** Sequential tools preserve side-effect order. There are no automatic tool retries. */
declare class ToolRuntime<Actor> {
    private readonly options;
    private readonly tools;
    private readonly rounds;
    private readonly calls;
    private readonly timeout;
    private readonly argumentBytes;
    private readonly resultBytes;
    constructor(options: ToolRuntimeOptions<Actor>);
    stream(request: GenerationRequest, actor: Actor): AsyncGenerator<ToolRuntimeEvent>;
    private run;
}

export { type RuntimeTool, type ToolContext, ToolExecutionError, ToolRuntime, type ToolRuntimeEvent, type ToolRuntimeOptions, defineTool };

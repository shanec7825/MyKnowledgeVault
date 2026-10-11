import { c as TokenUsage } from '../index-BYxnMqfP.cjs';
import 'zod';
import '../ai/browser.cjs';

type CliOutputEvent = {
    type: 'text';
    text: string;
} | {
    type: 'usage';
    usage: TokenUsage;
} | {
    type: 'failure';
    message: string;
};
declare class CliProtocolError extends Error {
    constructor(message: string);
}
/** Decodes Codex exec --json without exposing tool output or reasoning as answer text. */
declare class CodexOutputDecoder {
    private readonly lines;
    private terminal;
    private readonly messages;
    constructor(maximumLineChars?: number);
    push(text: string): Generator<CliOutputEvent>;
    /** On transport failure drain measurements with requireTerminal=false, then preserve that failure. */
    finish(requireTerminal?: boolean): Generator<CliOutputEvent>;
    private decode;
}
interface ClaudeOutputOptions {
    maximumLineChars?: number;
}
/** Claude stream-json answers, deduplicated per message and text block. */
declare class ClaudeOutputDecoder {
    private readonly options;
    private readonly lines;
    private readonly messages;
    private active;
    private terminal;
    private produced;
    constructor(options?: ClaudeOutputOptions);
    push(text: string): Generator<CliOutputEvent>;
    finish(requireTerminal?: boolean): Generator<CliOutputEvent>;
    private decode;
    private message;
    private identify;
    private index;
    private text;
}

export { ClaudeOutputDecoder, type ClaudeOutputOptions, type CliOutputEvent, CliProtocolError, CodexOutputDecoder };

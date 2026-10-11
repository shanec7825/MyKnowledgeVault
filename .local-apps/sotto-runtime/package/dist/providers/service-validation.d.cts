import { z } from 'zod';
import { CredentialValidation } from '../ai/browser.cjs';
import { ProviderModality } from './catalog.cjs';

/** Each protocol is an authenticated service contract, independent of application provider aliases. */
declare const protocols: {
    readonly pexels: {
        readonly origin: "https://api.pexels.com";
        readonly path: "/v1/search?query=language%20learning&per_page=1";
        readonly header: "authorization";
        readonly prefix: "";
        readonly proof: z.ZodObject<{
            photos: z.ZodArray<z.ZodObject<{
                id: z.ZodNumber;
            }, z.core.$strip>>;
            page: z.ZodNumber;
            per_page: z.ZodNumber;
            total_results: z.ZodNumber;
        }, z.core.$strip>;
    };
    readonly google: {
        readonly origin: "https://generativelanguage.googleapis.com";
        readonly path: "/v1beta/models?pageSize=1";
        readonly header: "x-goog-api-key";
        readonly prefix: "";
        readonly proof: z.ZodObject<{
            models: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    };
    readonly elevenlabs: {
        readonly origin: "https://api.elevenlabs.io";
        readonly path: "/v1/user";
        readonly header: "xi-api-key";
        readonly prefix: "";
        readonly proof: z.ZodObject<{
            user_id: z.ZodString;
            subscription: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
    };
    readonly cartesia: {
        readonly origin: "https://api.cartesia.ai";
        readonly path: "/voices?limit=1";
        readonly header: "authorization";
        readonly prefix: "Bearer ";
        readonly proof: z.ZodObject<{
            data: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
            }, z.core.$strip>>;
            has_more: z.ZodBoolean;
        }, z.core.$strip>;
    };
    readonly hume: {
        readonly origin: "https://api.hume.ai";
        readonly path: "/v0/tts/voices?provider=CUSTOM_VOICE&page_size=1";
        readonly header: "X-Hume-Api-Key";
        readonly prefix: "";
        readonly proof: z.ZodObject<{
            voices_page: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            page_number: z.ZodNumber;
            page_size: z.ZodNumber;
            total_pages: z.ZodNumber;
        }, z.core.$strip>;
    };
    readonly fal: {
        readonly origin: "https://api.fal.ai";
        readonly path: "/v1/models/pricing?endpoint_id=fal-ai/flux/dev";
        readonly header: "authorization";
        readonly prefix: "Key ";
        readonly proof: z.ZodObject<{
            prices: z.ZodArray<z.ZodObject<{
                endpoint_id: z.ZodString;
                unit_price: z.ZodNumber;
                unit: z.ZodString;
                currency: z.ZodString;
            }, z.core.$strip>>;
            has_more: z.ZodBoolean;
            next_cursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    };
    readonly replicate: {
        readonly origin: "https://api.replicate.com";
        readonly path: "/v1/account";
        readonly header: "authorization";
        readonly prefix: "Bearer ";
        readonly proof: z.ZodObject<{
            username: z.ZodString;
            type: z.ZodEnum<{
                user: "user";
                organization: "organization";
            }>;
        }, z.core.$strip>;
    };
    readonly assemblyai: {
        readonly origin: "https://api.assemblyai.com";
        readonly path: "/v2/transcript?limit=1";
        readonly header: "authorization";
        readonly prefix: "";
        readonly proof: z.ZodObject<{
            transcripts: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            page_details: z.ZodObject<{
                limit: z.ZodNumber;
                result_count: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>;
    };
    readonly gladia: {
        readonly origin: "https://api.gladia.io";
        readonly path: "/v2/pre-recorded";
        readonly header: "x-gladia-key";
        readonly prefix: "";
        readonly proof: z.ZodObject<{
            items: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            first: z.ZodString;
            current: z.ZodString;
            next: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    };
    readonly playht: {
        readonly origin: "https://api.play.ht";
        readonly path: "/api/v2/cloned-voices";
        readonly header: "authorization";
        readonly prefix: "";
        readonly proof: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>>;
    };
    readonly deepgram: {
        readonly origin: "https://api.deepgram.com";
        readonly path: "/v1/projects";
        readonly header: "authorization";
        readonly prefix: "Token ";
        readonly proof: z.ZodObject<{
            projects: z.ZodArray<z.ZodObject<{
                project_id: z.ZodString;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    };
    readonly speechmatics: {
        readonly origin: "https://eu1.asr.api.speechmatics.com";
        readonly path: "/v2/jobs?limit=1";
        readonly header: "authorization";
        readonly prefix: "Bearer ";
        readonly proof: z.ZodObject<{
            jobs: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>;
    };
    readonly rime: {
        readonly origin: "https://users.rime.ai";
        readonly path: "/oov";
        readonly header: "authorization";
        readonly prefix: "Bearer ";
        readonly proof: z.ZodArray<z.ZodString>;
    };
    readonly sunoapi: {
        readonly origin: "https://api.sunoapi.org";
        readonly path: "/api/v1/generate/credit";
        readonly header: "authorization";
        readonly prefix: "Bearer ";
        readonly proof: z.ZodObject<{
            code: z.ZodLiteral<200>;
            data: z.ZodNumber;
            msg: z.ZodString;
        }, z.core.$strip>;
    };
};
type ServiceCredentialProtocol = keyof typeof protocols;
/** Resolve catalog aliases only after checking the requested modality. */
declare function providerServiceProtocol(provider: string, modality: ProviderModality): ServiceCredentialProtocol | null;
/** Metadata only. Never replaces a caller's already selected destination. */
declare function serviceCredentialOrigin(protocol: ServiceCredentialProtocol): string;
interface ServiceCredentialSelection {
    protocol: ServiceCredentialProtocol;
    /** Explicit selected credential destination. Custom destinations require their own authentication contract. */
    origin: string;
    credentials: Readonly<{
        apiKey?: string;
        userId?: string;
    }>;
    /** Required for Cartesia and captured from the generation transport's API contract. */
    apiVersion?: string;
}
/** No environment lookup, generation, redirects, or raw vendor payloads escape this check. */
declare function validateServiceCredentials(selection: ServiceCredentialSelection, signal?: AbortSignal): Promise<CredentialValidation>;

export { type ServiceCredentialProtocol, type ServiceCredentialSelection, providerServiceProtocol, serviceCredentialOrigin, validateServiceCredentials };

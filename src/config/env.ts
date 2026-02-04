import { z } from "zod";
import { env as loadEnv } from "custom-env";

process.env.NODE_ENV = process.env.NODE_ENV || "development";


const isDevelopment = process.env.NODE_ENV === "development";
// const isTesting = process.env.NODE_ENV === "testing";

if (isDevelopment)
    loadEnv()     // loads the default .env
// else if (isTesting)
//     loadEnv("test")   // loads .env.test


const envSchema = z.object({
    MPESA_CONSUMER_KEY: z.string(),
    MPESA_CONSUMER_SECRET: z.string(),
    MPESA_PASS_KEY: z.string(),
    MPESA_SHORT_CODE: z.string(),
    MPESA_CALLBACK_URL: z.string().startsWith("https://"),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    MPESA_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
});


type Env = z.infer<typeof envSchema>;

let env: Env;


try {
    env = envSchema.parse(process.env);
} catch (err) {
    if (err instanceof z.ZodError) {
        console.error("❌ Invalid environment variables:");
        console.error(JSON.stringify(z.treeifyError(err), null, 2));

        err.issues.forEach((err) => {
            const path = err.path.join(".");
            const message = err.message;

            console.error(`${path}: ${message}`);
        });

        process.exit(1);
    }

    throw err;
}

// helper function for getting base url
function baseUrl(): string {
    return env.MPESA_ENVIRONMENT === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke"
}

// (Optional) Helper functions for environment checks
export const isProd = () => env.NODE_ENV === "production";
export const isDev = () => env.NODE_ENV === "development";


export { env, baseUrl };


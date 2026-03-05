import * as esbuild from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

esbuild
    .build({
        entryPoints: ["server/index.ts"],
        bundle: true,
        platform: "node",
        target: "node20",
        outfile: "dist/index.js",
        format: "esm",
        external: [
            "express",
            "pg",
            "drizzle-orm",
            "dotenv",
            "passport",
            "passport-google-oauth20",
            "express-session",
            "connect-pg-simple",
            "vite",
            "multer",
            "compression"
        ],
    })
    .then(() => {
        console.log("Server build complete.");
    })
    .catch((err) => {
        console.error("Server build failed:");
        console.error(err);
        process.exit(1);
    });

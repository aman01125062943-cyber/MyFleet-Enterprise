
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import sonarjs from "eslint-plugin-sonarjs";

export default [
    js.configs.recommended,
    {
        ignores: ["dist/**", "node_modules/**", "db_scripts_archive/**", "maintenance_scripts/**", ".agent/**", "eslint.config.js", "postcss.config.js", "tailwind.config.js", "vite.config.ts", "tsconfig.json", "whatsapp-service/**"]
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                navigator: "readonly",
                localStorage: "readonly",
                sessionStorage: "readonly",
                alert: "readonly",
                confirm: "readonly",
                prompt: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                requestAnimationFrame: "readonly",
                cancelAnimationFrame: "readonly",
                Blob: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                fetch: "readonly",
                WebSocket: "readonly",
                EventSource: "readonly",
                FormData: "readonly",
                Headers: "readonly",
                Request: "readonly",
                Response: "readonly",
                crypto: "readonly",
                // Node.js globals
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                global: "readonly"
            }
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            "sonarjs": sonarjs
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...sonarjs.configs.recommended.rules,
            "no-undef": "off",
            "sonarjs/cognitive-complexity": ["warn", 20],
            "sonarjs/no-duplicate-string": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_"
            }],
            "sonarjs/no-nested-conditional": "warn",
            "@typescript-eslint/ban-ts-comment": "warn",
            "sonarjs/no-ignored-exceptions": "warn",
            "sonarjs/pseudo-random": "warn",
            "sonarjs/no-dead-store": "warn",
            "sonarjs/use-type-alias": "warn",
            "sonarjs/slow-regex": "warn"
        }
    },
    {
        files: ["**/*.js", "**/*.jsx"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                // CommonJS globals
                module: "writable",
                exports: "writable",
                require: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                navigator: "readonly",
                localStorage: "readonly",
                sessionStorage: "readonly",
                alert: "readonly",
                confirm: "readonly",
                prompt: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                requestAnimationFrame: "readonly",
                cancelAnimationFrame: "readonly",
                Blob: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                fetch: "readonly",
                WebSocket: "readonly",
                EventSource: "readonly",
                FormData: "readonly",
                Headers: "readonly",
                Request: "readonly",
                Response: "readonly",
                crypto: "readonly",
                // Node.js globals
                process: "readonly",
                Buffer: "readonly",
                global: "readonly"
            }
        },
        plugins: {
            "sonarjs": sonarjs
        },
        rules: {
            ...sonarjs.configs.recommended.rules,
            "sonarjs/cognitive-complexity": ["warn", 20],
            "sonarjs/no-duplicate-string": "off",
            "no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_"
            }],
            "sonarjs/no-nested-conditional": "warn",
            "sonarjs/no-ignored-exceptions": "warn",
            "sonarjs/pseudo-random": "warn",
            "sonarjs/no-dead-store": "warn",
            "sonarjs/use-type-alias": "warn",
            "sonarjs/slow-regex": "warn"
        }
    },
    {
        files: ["whatsapp-server/**/*.js"],
        languageOptions: {
            sourceType: "module",
            globals: {
                process: "readonly",
                console: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly"
            }
        }
    }
];

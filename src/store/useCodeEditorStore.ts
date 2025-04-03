import { LANGUAGE_CONFIG } from "@/app/(root)/_constants"; // Ensure this path is correct
import { create } from "zustand";
import { Monaco, EditorProps } from "@monaco-editor/react";
import { editor } from "monaco-editor";

// Update the type definition
interface CodeEditorState {
    language: string;
    fontSize: number;
    theme: string;
    output: string;
    isRunning: boolean;
    error: null | string;  // 🔹 Changed from `Error` to `string`
    editor: editor.IStandaloneCodeEditor | null;
    executionResult: null | { code: string; output: string; error: string | null };
    getCode: () => string;
    setEditor: (editor: editor.IStandaloneCodeEditor) => void;
    setTheme: (theme: string) => void;
    setFontSize: (fontSize: number) => void;
    setLanguage: (language: string) => void;
    runCode: () => Promise<void>;
}

// Function to get initial editor state
const getInitialState = () => {
    if (typeof window === "undefined") {
        return {
            language: "javascript",
            fontSize: 16,
            theme: "vs-dark",
        };
    }

    return {
        language: localStorage.getItem("editor-language") || "javascript",
        theme: localStorage.getItem("editor-theme") || "vs-dark",
        fontSize: Number(localStorage.getItem("editor-font-size") || 16),
    };
};

// Zustand store
export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
    const initialState = getInitialState();

    return {
        ...initialState,
        output: "",
        isRunning: false,
        error: null,
        editor: null,
        executionResult: null,

        getCode: () => get().editor?.getValue() || "",

        setEditor: (editor: editor.IStandaloneCodeEditor) => {
            const savedCode = localStorage.getItem(`editor-code-${get().language}`);
            if (savedCode) editor.setValue(savedCode);
            set({ editor });
        },

        setTheme: (theme: string) => {
            localStorage.setItem("editor-theme", theme);
            set({ theme });
        },

        setFontSize: (fontSize: number) => {
            localStorage.setItem("editor-font-size", fontSize.toString());
            set({ fontSize });
        },

        setLanguage: (language: string) => {
            // Save current language code before switching
            const currentCode = get().editor?.getValue();
            if (currentCode) {
                localStorage.setItem(`editor-code-${get().language}`, currentCode);
            }
        
            localStorage.setItem("editor-language", language);
        
            set({
                language,
                output: "",
                error: null,
            });
        },

        runCode: async () => {
            const { language, getCode } = get();
            const code = getCode();
        
            if (!code) {
                set({ error: "Please enter some code" });
                return;
            }
        
            set({ isRunning: true, error: null, output: "" });
        
            try {
                const runtime = LANGUAGE_CONFIG[language]?.pistonRuntime;
                if (!runtime) {
                    set({ error: `Unsupported language: ${language}` });
                    return;
                }
        
                const response = await fetch("https://emkc.org/api/v2/piston/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        language: runtime.language,
                        version: runtime.version,
                        files: [{ content: code }],
                    }),
                });

                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
        
                const data = await response.json();
                console.log("Response from Piston:", data);
        
                if (data.message) {
                    set({ error: data.message, executionResult: { code, output: "", error: data.message } });
                    return;
                }
        
                if (data.compile && data.compile.code !== 0) {
                    const errorMsg = data.compile.stderr || data.compile.output || "Compilation error";
                    set({ error: errorMsg, executionResult: { code, output: "", error: errorMsg } });
                    return;
                }
        
                if (data.run && data.run.code !== 0) {
                    const errorMsg = data.run.stderr || data.run.output || "Runtime error";
                    set({ error: errorMsg, executionResult: { code, output: "", error: errorMsg } });
                    return;
                }
        
                // Successful execution
                const output = data.run.output.trim();
                set({ output, error: null, executionResult: { code, output, error: null } });
        
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Error running code";
                console.error("Error running code:", errorMessage);
        
                set({
                    error: errorMessage,
                    executionResult: { code, output: "", error: errorMessage },
                });
            } finally {
                set({ isRunning: false });
            }
        },
    };
});

// Function to get execution result
export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;

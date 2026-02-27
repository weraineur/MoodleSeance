"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// Core VS Code API used to register commands and show UI messages.
const vscode = __importStar(require("vscode"));
// Centralize user notifications so messages are consistent.
function info(message) {
    void vscode.window.showInformationMessage(message);
}
function activate(context) {
    // Define the pipeline steps and stub handlers for now.
    const steps = [
        {
            id: "moodleSeance.importDocuments",
            title: "Import Documents",
            handler: async () => {
                // TODO: prompt for files and store selection.
                info("Import step: select documents to ingest.");
            }
        },
        {
            id: "moodleSeance.extract",
            title: "Extract Content",
            handler: async () => {
                // TODO: extract text from supported file types.
                info("Extraction step: parse and normalize content.");
            }
        },
        {
            id: "moodleSeance.confirm",
            title: "Confirm Inputs",
            handler: async () => {
                // TODO: show a preview and ask for confirmation.
                info("Confirmation step: review extracted content before sending.");
            }
        },
        {
            id: "moodleSeance.sendToModel",
            title: "Send to Model",
            handler: async () => {
                // TODO: assemble prompt and send to OpenAI.
                info("Send step: dispatch prompt to the model.");
            }
        },
        {
            id: "moodleSeance.generate",
            title: "Generate Outputs",
            handler: async () => {
                // TODO: build outputs from model response.
                info("Generation step: build the requested artifacts.");
            }
        },
        {
            id: "moodleSeance.export",
            title: "Export Outputs",
            handler: async () => {
                // TODO: write outputs to files or workspace.
                info("Export step: save outputs to disk.");
            }
        }
    ];
    // Register each command with VS Code.
    for (const step of steps) {
        const command = vscode.commands.registerCommand(step.id, step.handler);
        context.subscriptions.push(command);
    }
}
// Deactivate hook kept for completeness.
function deactivate() { }
//# sourceMappingURL=extension.js.map
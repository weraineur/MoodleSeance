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
const state = {
    files: [],
    lastResponse: null
};
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
                const result = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        Documents: ["doc", "docx", "ppt", "pptx", "pdf", "txt", "xls", "xlsx"],
                    }
                });
                if (!result || result.length === 0) {
                    info("Import annulée : aucun fichier sélectionné.");
                    return;
                }
                state.files = result.map((uri) => uri.fsPath);
                info(`Import réussi : ${state.files.length} fichier(s) sélectionné(s).`);
            }
        },
        {
            id: "moodleSeance.extract",
            title: "Extract Content",
            handler: async () => {
                if (state.files.length === 0) {
                    info("Aucun fichier à extraire. Veuillez importer des documents d'abord.");
                    return;
                }
                info('Extraction simulée : contenu extrait de ' + state.files.length + ' fichier(s).');
            }
        },
        {
            id: "moodleSeance.confirm",
            title: "Confirm Inputs",
            handler: async () => {
                if (state.files.length === 0) {
                    info("Aucun fichier à confirmer. Veuillez importer et extraire des documents d'abord.");
                    return;
                }
                const preview = state.files.slice(0, 10).join("\n");
                const more = state.files.length > 10 ? `\n...and ${state.files.length - 10} more` : "";
                const message = `Fichiers importés : \n${preview}${more}\n\n Confirmez-vous ces fichiers pour la génération ?`;
                const choice = await vscode.window.showInformationMessage(message, { modal: true }, "Confirmer");
                if (!choice) {
                    info("Confirmation annulée par l'utilisateur.");
                    return;
                }
                info("Fichiers confirmés pour la génération.");
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
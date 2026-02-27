// Core VS Code API used to register commands and show UI messages.
import * as vscode from "vscode";

type PipelineStep = {
  id: string;
  title: string;
  handler: () => Promise<void> | void;
};

// Centralize user notifications so messages are consistent.
function info(message: string) {
  void vscode.window.showInformationMessage(message);
}

export function activate(context: vscode.ExtensionContext) {
  // Define the pipeline steps and stub handlers for now.
  const steps: PipelineStep[] = [
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
export function deactivate() {}

import * as vscode from 'vscode';

// This class represents the custom editor for log files
class LogViewerProvider implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'logViewer';

    constructor(private readonly context: vscode.ExtensionContext) { }

    // Called when a custom document is opened. Provides an in-memory representation of the document.
    public async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        // In this simple example, we don't need to store document data, so we return a minimal custom document.
        return { uri, dispose: (): void => { } };
    }

    // Called to create the UI of the custom editor, using a webview.
    public async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        // Read file content
        const content = await vscode.workspace.fs.readFile(document.uri);
        const logText = Buffer.from(content).toString('utf8');
    
        // Generate HTML for the webview
        const htmlContent = this.generateHtmlContent(logText);
        webviewPanel.webview.options = { 
            enableScripts: true,
        };

        (webviewPanel.options as any).enableFindWidget = true;

        (webviewPanel.webview.options as any).enableFindWidget = true;


        webviewPanel.webview.html = htmlContent;

        
    }

    private generateHtmlContent(logText: string): string {
        // Split the log text into lines
        const logLines = logText.split('\n');

        // Start building the HTML content
        let htmlContent = `
            <html>
            <head>
                <style>
                    body { font-family: Consolas, monospace; background-color: #1e1e1e; color: #d4d4d4; }
                    .log-date { color: #9A9A9A; } /* Lighter grey for less critical info */
                    .log-source { color: #A8A8A8; } /* Light grey for the source, slightly lighter than date */
                    .log-level-silly { color: #FFC0CB; } /* Soft pink, adjust if too bright */
                    .log-level-debug { color: #7B68EE; } /* Medium slate blue, darker than previous */
                    .log-level-trace { color: #3CB371; } /* Medium sea green, darker shade */
                    .log-level-info { color: #1E90FF; } /* Dodger blue for info */
                    .log-level-warn { color: #FFA500; } /* Orange, a bit darker for better contrast */
                    .log-level-error { color: #FF4500; } /* OrangeRed, slightly darker */
                    .log-level-fatal { color: #B22222; } /* Firebrick, dark red for fatal */
                    .log-message { color: #E6E6E6; } /* Slightly off-white for the main message */
                    .log-entry:hover {
                        background-color: #2e2e2e; /* Darker than the body background for subtle highlighting */
                    }

                    .log-entry {
                        display: flex;
                        align-items: baseline; /* Aligns items in their baseline for a more uniform look */
                        margin-bottom: 3px;
                        margin-top: 3px;
                        gap: 8px; /* Adds some space between the flex items */
                    }
                    
                    .log-date, .log-level-info, .log-level-warn, .log-level-error, .log-level-fatal, .log-level-debug, .log-level-trace, .log-level-silly {
                        white-space: nowrap; /* Prevents these elements from wrapping */
                    }
                    

                    /* Existing styles */

                    .key { color: #9cdcfe; } /* Light blue for JSON keys */
                    .string { color: #ce9178; } /* Light orange for strings */
                    .number { color: #b5cea8; } /* Light green for numbers */
                    .boolean { color: #569cd6; } /* Bold blue for true/false */
                    .null { color: #569cd6; } /* Same bold blue for null */
                
                    .log-message {
                        color: #E6E6E6; /* Slightly off-white for the main message */
                        flex-grow: 1; /* Allows the message to take up the remaining space */
                        overflow-wrap: anywhere; /* Ensures long words are broken and wrapped */
                        // word-wrap: break-word; /* Older browsers */
                    }
                    
                    .log-json {
                        display: inline; /* Allows element to be sized according to its content, up to the max width of its container */
                        max-width: 100%; /* Prevents the element from extending beyond the width of its container */
                    }
                    
                    /* Specific to compact JSON, if needed */
                    .log-json.compact {
                        white-space: normal; /* Allow wrapping in compact mode */
                        max-width: 100%; /* Limit width to prevent overflow */
                    }
                    
                    .log-json.expanded {
                        white-space: pre-wrap; /* Preserve formatting while allowing wrapping in expanded mode */
                    }
                    
            
            
                </style>
                <script>
                    function expandJson(element) {
                        const encodedJson = element.getAttribute('data-json');
                        const json = JSON.parse(decodeURIComponent(encodedJson));
                    
                        if (element.classList.contains('expanded')) {
                            element.classList.remove('expanded');
                            const compactJsonHtml = syntaxHighlightJson(JSON.stringify(json)); // Use syntax highlighting
                            element.innerHTML = compactJsonHtml; // Update to maintain styles
                        } else {
                            element.classList.add('expanded');
                            const expandedHtml = syntaxHighlightJson(JSON.stringify(json, null, 4));
                            element.innerHTML = expandedHtml;
                        }
                    }

                    function ${this.syntaxHighlightJson.toString()}
                </script>
            </head>
            <body>
			
        `;

        // Iterate over each log line, parse it, and append it to the HTML content
        logLines.forEach(line => {
            try {
                const logEntry = JSON.parse(line);
                const formattedLine = this.formatLogLine(logEntry);
                htmlContent += `<div class="log-entry">${formattedLine}</div>`;
            } catch (error) {
                // Handle lines that cannot be parsed as JSON
                console.error("Error parsing log line:", error), line;
            }
        });

        // Close the HTML content
        htmlContent += `
            </body>
            </html>
        `;

        return htmlContent;
    }

    private isJson(str: string): boolean {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    private syntaxHighlightJson(jsonString: string): string {
        let formattedJson = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return formattedJson.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key'; // Keys
                } else {
                    cls = 'string'; // String values
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean'; // Booleans
            } else if (/null/.test(match)) {
                cls = 'null'; // null
            }
            // Preserve match exactly as is, including any spaces

            return '<span class="' + cls + '">' + match + '</span>';
        });
    }


    private formatLogLine(logEntry: any): string {
        const date = logEntry.date || '';
        const logLevel = logEntry.logLevel || '';
        const filePath = logEntry.filePath || '';
        const lineNumber = logEntry.lineNumber || '';
        const functionName = logEntry.functionName || '';
        const argumentsArray = logEntry.argumentsArray || [];

        // Determine the CSS class for the log level
        let logLevelClass = `log-level-${logLevel.toLowerCase()}`;

        // Enhanced JSON processing
        const processedArguments = argumentsArray.map((arg: any) => {
            if (this.isJson(arg)) {
                const json = JSON.parse(arg); // Parse the JSON to an object
                const compactJsonHtml = this.syntaxHighlightJson(JSON.stringify(json)); // Apply highlighting to compact JSON
                console.log("uncomputed", JSON.stringify(json));
                const encodedJson = encodeURIComponent(arg); // Encode original JSON for use in expand/collapse

                // Initially display the compact version with highlighting
                // Store the original JSON in a data attribute for expanding
                return `<span class="log-json compact" data-json="${encodedJson}" onclick="expandJson(this)">${compactJsonHtml}</span>`;
            } else {
                return this.escapeHtml(arg);
            }



        }).join(" ");




        return `
        <div class="log-entry">
            <span class="log-date">${this.escapeHtml(date)}</span>
            <span class="${logLevelClass}">${this.escapeHtml(logLevel)}</span>
            <div class="log-message">
                <span class="log-source">${this.escapeHtml(`[${filePath}:${lineNumber} ${functionName}]`)}</span>
                ${processedArguments} <!-- Ensure processedArguments are always wrapped in syntax-highlighting spans -->
            </div>
        </div>
        `;
    }

    // Utility method to escape HTML special characters to prevent XSS or rendering issues
    private escapeHtml(unsafeText: string): string {
        return unsafeText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


}

// This is the main activation function of your extension.
export function activate(context: vscode.ExtensionContext) {
    // Register our custom editor provider with VSCode.
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            LogViewerProvider.viewType,
            new LogViewerProvider(context),
            {
                // Tells VSCode to use the webviewPanel's serializer if available
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                },
            }
        )
    );
}

// This function is called when your extension is deactivated
export function deactivate() { }

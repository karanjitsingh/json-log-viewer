const { Logger } = require("tslog");
const fs = require("fs");
const path = require("path");

// Create a write stream in the same folder as this script
const logPath = path.join(__dirname, "example.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

const log = new Logger();

// Attach file transport - simplified
const writeToFile = logObject => logStream.write(JSON.stringify(logObject) + "\n");
log.attachTransport(
    {
        debug: writeToFile,
        info: writeToFile,
        warn: writeToFile,
        error: writeToFile
    },
    "debug"
);

// Example function to demonstrate different log levels
function demonstrateLogging() {
    log.debug("This is a debug message");
    log.info("Server started", JSON.stringify({ port: 3000 }));
    log.warn("High memory usage", JSON.stringify({ memory: "85%" }));
    log.error("Database connection failed", JSON.stringify({ error: "timeout" }));
    
    try {
        throw new Error("Out of memory");
    } catch (error) {
        log.error("System crash", JSON.stringify({ 
            error: error.message, 
            stack: error.stack 
        }));
    }
}

demonstrateLogging();
logStream.end(); 
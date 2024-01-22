const net = require("net"); // built-in net module used to create both servers and clients
const tls = require("tls");
const process = require("process");
const fs = require("fs");
const { get } = require("http");

// Arguments passed in by user
const args = process.argv.slice(2);
// Server listens to non-encrypted requests on a TCP socket bound to port 27993
let port = 27993;
let useTLS = false; // default to no TLS
let hostname, username;

// If the user passes in -s to terminal, use TLS
if (args.includes("-s")) {
  useTLS = true;
  port = 27994; // default TLS port
}

// If the user passes in -p to terminal, use the port number that follows
let portIndex = args.indexOf("-p");
if (portIndex !== -1 && args.length > portIndex + 1) {
  port = parseInt(args[portIndex + 1]);
}

// Set hostname and username to corresponding values
hostname = args[args.length - 2];
username = args[args.length - 1];

// Loads words from project1-words.txt file
function loadWordFile() {
  const text = fs.readFileSync("project1-words.txt", "utf-8");
  const words = text.split("\r\n");
  return words;
}

const words = loadWordFile();
let possibleWords = words;
// console.log(port);
// console.log("hostname: ", hostname, "\nusername: ", username);

// tls.connect(port number to connect to, hostname of server, callback function for when connection is established), creates secure client that uses TLS to encrypt connection
// net.createConnection(port number to connect to, hostname of server, callback function for when connection is established), creates non-secure client
let client;
let lastWord = "stare";

function createClient() {
  client = useTLS
    ? tls.connect(port, hostname, onConnect) // If useTLS=true, use tls.connect for server connection
    : net.createConnection(port, hostname, onConnect);
  function onConnect() {
    console.log(
      `Connected to ${hostname}:${port} using ${useTLS ? "TLS" : "TCP"}`
    );
    helloMSG(client);
  }

  // Handles server response data
  client.on("data", (data) => {
    handleServerResponse(data);
  });

  // Error handling
  client.on("error", (error) => {
    console.log("Error:", error);
  });

  // Closes program when connection is closed
  client.on("close", () => {
    console.log("Connection closed");
  });

  //   client.setTimeout(1000);
  //   client.on("timeout", () => {
  //     console.log("Connection timed out");
  //     client.end();
  //   });
}

// Sends hello message to server
function helloMSG() {
  let hello = { type: "hello", northeastern_username: username };
  console.log("Sending hello message:", hello);
  client.write(JSON.stringify(hello) + "\n");
}

// Handles start case, sends initial guess message to server, currently using "stare"
function handleStartCase(msg) {
  console.log("Received start message: ", msg);
  sendGuess(msg.id, lastWord);
}

// Sends guess message to server, updates lastWord to the word that was sent
function sendGuess(id, word) {
  let guess = { type: "guess", id: id, word: word };
  console.log("Sending guess:", guess);
  lastWord = word;
  client.write(JSON.stringify(guess) + "\n");
}

// Handles retry case, sends guess message to server, filters words to provide new guess
function handleRetryCase(msg) {
  let prevGuesses = msg.guesses;
  let lastMarks = prevGuesses[prevGuesses.length - 1].marks; // Marks of the last guess
  console.log("Received retry message with last marks: ", lastMarks);
  possibleWords = filterWords(lastMarks);
  console.log(
    `Removing words by incorrect position. There are ${possibleWords.length} possible words left.`
  );
  sendGuess(msg.id, possibleWords[0]);
}

// Handles bye case, prints flag and ends connection
function handleByeCase(msg) {
  const flag = msg.flag;
  console.log("Game successfully completed. Flag: ", flag);
  client.end();
}

//  Handles all server responses depending on what type of message is received from server
function handleServerResponse(data) {
  let msg = JSON.parse(data.toString());
  switch (msg.type) {
    case "start":
      handleStartCase(msg);
      break;
    case "retry":
      handleRetryCase(msg);
      break;
    case "bye":
      handleByeCase(msg);
      break;
    case "error":
      //handleErrorCase(msg);
      console.error("Error:", msg.msg);
      client.destroy();
      break;
  }
}

// Checks if a word has repeating letters
let hasRepeats = function (word, letterToCheck) {
  let count = 0;
  for (let letter of word) {
    if (letter === letterToCheck) {
      count++;
      if (count > 1) {
        return true; // Found the letter repeating
      }
    }
  }
  return false; // The letter does not repeat
};

// Filters words based on the marks of the last guess
function filterWords(lastMarks) {
  let requiredLetters = [];

  // Gets the required letters that need to be in the word
  lastWord.split("").forEach((letter, index) => {
    if (lastMarks[index] > 0) {
      requiredLetters.push(letter);
    }
  });

  // Filters words based on the required letters
  return possibleWords.filter((word) => {
    for (let letter of requiredLetters) {
      if (!word.includes(letter)) {
        return false;
      }
    }

    // Ensures repeated letters in words don't get skipped, don't auto remove words that have letters in a 0 position
    for (let i = 0; i < lastMarks.length; i++) {
      if (lastMarks[i] === 0) {
        if (hasRepeats(lastWord, lastWord[i]) && word[i] !== lastWord[i]) {
          return true;
        } else if (word.includes(lastWord[i])) {
          return false;
        }
      }
      // Remove words that have letters in a 1 position that are in the same position as the last word
      if (lastMarks[i] === 1 && word[i] === lastWord[i]) {
        return false;
      }
      // Remove words that have letters in a 2 position that are not in the same position as the last word
      if (lastMarks[i] === 2 && word[i] !== lastWord[i]) {
        return false;
      }
    }
    return true;
  });
}

// Create the client
createClient();

/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 873:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const os = __nccwpck_require__(37);

module.exports = (process.env['OS'] != 'Windows_NT') ? {
    // Use getent() system call, since this is what ssh does; makes a difference in Docker-based
    // Action runs, where $HOME is different from the pwent
    homePath: os.userInfo().homedir,
    sshAgentCmdDefault: 'ssh-agent',
    sshAddCmdDefault: 'ssh-add',
    gitCmdDefault: 'git'
} : {
    // Assuming GitHub hosted `windows-*` runners for now
    homePath: os.homedir(),
    sshAgentCmdDefault: 'c://progra~1//git//usr//bin//ssh-agent.exe',
    sshAddCmdDefault: 'c://progra~1//git//usr//bin//ssh-add.exe',
    gitCmdDefault: 'c://progra~1//git//bin//git.exe'
};


/***/ }),

/***/ 389:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 81:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ 113:
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 37:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(389);
const child_process = __nccwpck_require__(81);
const fs = __nccwpck_require__(147);
const crypto = __nccwpck_require__(113);
const { homePath, sshAgentCmdDefault, sshAddCmdDefault, gitCmdDefault } = __nccwpck_require__(873);

try {
    const privateKey = core.getInput('ssh-private-key');
    const logPublicKey = core.getBooleanInput('log-public-key', {default: true});

    const sshAgentCmdInput = core.getInput('ssh-agent-cmd');
    const sshAddCmdInput = core.getInput('ssh-add-cmd');
    const gitCmdInput = core.getInput('git-cmd');

    const sshAgentCmd = sshAgentCmdInput ? sshAgentCmdInput : sshAgentCmdDefault;
    const sshAddCmd = sshAddCmdInput ? sshAddCmdInput : sshAddCmdDefault;
    const gitCmd = gitCmdInput ? gitCmdInput : gitCmdDefault;

    if (!privateKey) {
        core.setFailed("The ssh-private-key argument is empty. Maybe the secret has not been configured, or you are using a wrong secret name in your workflow file.");

        return;
    }

    const slash = (process.env['OS'] != 'Windows_NT') ? '\\' : '/'
    const homeSsh = homePath + `${slash}.ssh`;
    fs.mkdirSync(homeSsh, { recursive: true });

    console.log("Starting ssh-agent");

    const authSock = core.getInput('ssh-auth-sock');
    const sshAgentArgs = (authSock && authSock.length > 0) ? ['-a', authSock] : [];

    // Extract auth socket path and agent pid and set them as job variables
    child_process.execFileSync(sshAgentCmd, sshAgentArgs).toString().split("\n").forEach(function(line) {
        const matches = /^(SSH_AUTH_SOCK|SSH_AGENT_PID)=(.*); export \1/.exec(line);

        if (matches && matches.length > 0) {
            // This will also set process.env accordingly, so changes take effect for this script
            core.exportVariable(matches[1], matches[2])
            console.log(`${matches[1]}=${matches[2]}`);
        }
    });

    console.log("Adding private key(s) to agent");

    privateKey.split(/(?=-----BEGIN)/).forEach(function(key) {
        child_process.execFileSync(sshAddCmd, ['-'], { input: key.trim() + "\n" });
    });

    console.log("Key(s) added:");

    child_process.execFileSync(sshAddCmd, ['-l'], { stdio: 'inherit' });

    console.log('Configuring deployment key(s)');

    child_process.execFileSync(sshAddCmd, ['-L']).toString().trim().split(/\r?\n/).forEach(function(key) {
        const parts = key.match(/\bgithub\.com[:/]([_.a-z0-9-]+\/[_.a-z0-9-]+)/i);

        if (!parts) {
            if (logPublicKey) {
              console.log(`Comment for (public) key '${key}' does not match GitHub URL pattern. Not treating it as a GitHub deploy key.`);
            }
            return;
        }

        const sha256 = crypto.createHash('sha256').update(key).digest('hex');
        const ownerAndRepo = parts[1].replace(/\.git$/, '');

        fs.writeFileSync(`${homeSsh}${slash}key-${sha256}`, key + "\n", { mode: '600' });

        child_process.execSync(`${gitCmd} config --global --replace-all url."git@key-${sha256}.github.com:${ownerAndRepo}".insteadOf "https://github.com/${ownerAndRepo}"`);
        child_process.execSync(`${gitCmd} config --global --add url."git@key-${sha256}.github.com:${ownerAndRepo}".insteadOf "git@github.com:${ownerAndRepo}"`);
        child_process.execSync(`${gitCmd} config --global --add url."git@key-${sha256}.github.com:${ownerAndRepo}".insteadOf "ssh://git@github.com/${ownerAndRepo}"`);

        const sshConfig = `\nHost key-${sha256}.github.com\n`
                              + `    HostName github.com\n`
                              + `    IdentityFile ${homeSsh}${slash}key-${sha256}\n`
                              + `    IdentitiesOnly yes\n`;

        fs.appendFileSync(`${homeSsh}${slash}config`, sshConfig);

        console.log(`Added deploy-key mapping: Use identity '${homeSsh}${slash}key-${sha256}' for GitHub repository ${ownerAndRepo}`);
    });

} catch (error) {

    if (error.code == 'ENOENT') {
        console.log(`The '${error.path}' executable could not be found. Please make sure it is on your PATH and/or the necessary packages are installed.`);
        console.log(`PATH is set to: ${process.env.PATH}`);
    }

    core.setFailed(error.message);
}

})();

module.exports = __webpack_exports__;
/******/ })()
;
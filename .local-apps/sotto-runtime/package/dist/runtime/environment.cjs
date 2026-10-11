'use strict';

// src/runtime/process/environment.ts
var baseKeys = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TZ",
  "TERM",
  "SHELL",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "SYSTEMROOT",
  "WINDIR",
  "SSH_AUTH_SOCK",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS"
];
function agentEnvironment(source, credentialKeys = []) {
  const result = {};
  for (const key of [...baseKeys, ...credentialKeys]) {
    const value = source[key];
    if (value !== void 0) result[key] = value;
  }
  return result;
}
function shellQuote(value) {
  if (value.includes("\0")) throw new Error("Shell arguments cannot contain null bytes");
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function agentInvocation(command, args, connection) {
  if (!connection) return { command, args: [...args] };
  if (!/^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*@)?[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(connection.host))
    throw new Error("Invalid SSH host");
  const options = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes"];
  const pin = connection.pinnedIdentity;
  if (pin) {
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(pin.user) || !/^sidedoor-[a-f0-9]{32}$/.test(pin.alias) || ![
      "ssh-ed25519",
      "ecdsa-sha2-nistp256",
      "ecdsa-sha2-nistp384",
      "ecdsa-sha2-nistp521",
      "rsa-sha2-512,rsa-sha2-256"
    ].includes(pin.algorithms) || !pin.knownHostsFile.startsWith("/") || /[\r\n\0]/.test(pin.knownHostsFile))
      throw new Error("Invalid pinned SSH identity");
    const explicitUser = connection.host.includes("@") ? connection.host.split("@")[0] : void 0;
    if (explicitUser !== void 0 && explicitUser !== pin.user) throw new Error("SSH account changed");
    options.push("-l", pin.user);
    for (const option of [
      `HostKeyAlias=${pin.alias}`,
      `UserKnownHostsFile=${JSON.stringify(pin.knownHostsFile.replace(/%/g, "%%"))}`,
      "GlobalKnownHostsFile=/dev/null",
      "KnownHostsCommand=none",
      "VerifyHostKeyDNS=no",
      "UpdateHostKeys=no",
      `HostKeyAlgorithms=${pin.algorithms}`,
      "CheckHostIP=no",
      "ControlMaster=no",
      "ControlPath=none",
      "ControlPersist=no",
      "CanonicalizeHostname=no",
      "ForwardAgent=no",
      "ForwardX11=no",
      "ClearAllForwardings=yes",
      "PermitLocalCommand=no",
      "RemoteCommand=none",
      "RequestTTY=no",
      "StdinNull=no",
      "ForkAfterAuthentication=no"
    ])
      options.push("-o", option);
  }
  if (connection.identityFile) options.push("-i", connection.identityFile);
  if (!pin && connection.knownHostsFile)
    options.push("-o", `UserKnownHostsFile=${connection.knownHostsFile}`);
  return {
    command: "ssh",
    args: [...options, "-T", "--", connection.host, [command, ...args].map(shellQuote).join(" ")]
  };
}

exports.agentEnvironment = agentEnvironment;
exports.agentInvocation = agentInvocation;
exports.shellQuote = shellQuote;

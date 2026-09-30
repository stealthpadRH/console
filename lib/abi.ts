import { parseAbi } from "viem";

// The contract surface the console calls. The full ABIs are generated in stealthpad-foundry.

export const factoryAbi = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "struct LaunchInput { string name; string symbol; string logo; string description; Socials socials; bytes32 salt; }",
  "function launch(LaunchInput input, uint16 taxBps, uint256 minTokensOut) payable returns (address vault, address token)",
  "function predict(address launcher, bytes32 salt, uint16 taxBps) view returns (address)",
  "function launchesOpen() view returns (bool)",
  "function vaultOf(address token) view returns (address vault)",
]);

export const vaultAbi = parseAbi([
  "function claim(uint256 cumulative, bytes32[] proof, address to, uint16 feeBps) returns (uint256 paid)",
  "function claimed(address holder) view returns (uint256 cumulative)",
  "function runRound() returns (uint64 roundId)",
  "function roundReady() view returns (bool)",
  "function nextRoundAt() view returns (uint256)",
  "function pendingEth() view returns (uint256 total)",
  "error BadProof()",
  "error BadRecipient()",
  "error BelowMinimum(uint256 budget)",
  "error CoolingDown(uint256 availableAt)",
  "error FeeTooHigh()",
  "error NothingToClaim()",
  "error SwapOutTooLow(uint256 out, uint256 minOut)",
  "error TipFailed()",
]);

export const ponsAbi = parseAbi(["function launchFee() view returns (uint256)"]);

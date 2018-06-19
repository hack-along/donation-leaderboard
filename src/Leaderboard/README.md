# Leaderboard component

## How to install
Copy the leaderboard folder into your leaderboard project and import it into the app component

```
import Leaderboard from "./Leaderboard/Leaderboard";
```

## How to use
Requires three props. Make sure to choose the right type, which can be figured out from looking at the source code of the donation contract address at etherscan. The loading process is slow, can take between 5-10s. A loader is displayed automatically while fetching.

```
const donationAddress = "0x5adf43dd006c6c36506e2b2dfa352e60002d22dc"; //replace with the address to watch
const deploymentBlock = "4448139"; // Passing a deployment block significantly speeds up the loading process
const leaderboardType = "leaderboard"; // can be a "leaderboard" or "multisig"
```

Then include: 

```
<Leaderboard
	address={donationAddress}
	deploymentBlock={deploymentBlock}
	type={leaderboardType}
/>
```
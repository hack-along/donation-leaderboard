import Web3Local from "web3";

const web3local = new Web3Local(
  new Web3Local.providers.WebsocketProvider("wss://mainnet.infura.io/_ws")
);

const blockExplorerLink = "https://etherscan.io/tx/";

const leaderboardAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ],
    name: "FundsSent",
    type: "event"
  }
];
const multisigAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "value", type: "uint256" }
    ],
    name: "Deposit",
    type: "event"
  }
];

const params = {};

function setParams(_params) {
  params.address = _params.address;
  params.deploymentBlock = _params.deploymentBlock || 0;
  switch (_params.type) {
    case "leaderboard":
      params.Abi = leaderboardAbi;
      params.eventName = "FundsSent";
      break;
    case "multisig":
      params.Abi = multisigAbi;
      params.eventName = "Deposit";
      break;
    default:
      throw Error("Unkown contract type");
  }
  params.contract = new web3local.eth.Contract(params.Abi, params.address);
}

function getPastDonations() {
  return params.contract
    .getPastEvents(params.eventName, {
      // filter: {myIndexedParam: [20,23], myOtherIndexedParam: '0x123456789...'}, // Using an array means OR: e.g. 20 or 23
      fromBlock: params.deploymentBlock,
      toBlock: "latest"
    })
    .then(ParseEvents)
    .then(AggregateEvents);
}

function getBalance() {
  return web3local.eth
    .getBalance(params.address)
    .then(balanceWei => web3local.utils.fromWei(balanceWei, "ether"));
}

function ParseEvents(events) {
  console.log("RECEIVED EVENTS", events);
  return Promise.all(
    events.map(tx =>
      web3local.eth.getTransaction(tx.transactionHash).then(txData => {
        // console.log("TXDATA", txData);
        return {
          address: tx.returnValues.sender,
          value: web3local.utils.fromWei(tx.returnValues.amount, "ether"),
          message: txData.input.length
            ? web3local.utils.hexToAscii(txData.input)
            : "",
          link: blockExplorerLink + txData.hash
        };
      })
    )
  );
}

function AggregateEvents(eventList) {
  const Aggr = {};
  eventList.forEach(event => {
    if (Aggr.hasOwnProperty(event.address)) {
      Aggr[event.address].value += parseFloat(event.value);
      Aggr[event.address].message = event.message;
      Aggr[event.address].links.push(event.link);
    } else {
      Aggr[event.address] = {
        address: event.address,
        value: parseFloat(event.value),
        message: event.message,
        links: [event.link]
      };
    }
  });
  return Object.getOwnPropertyNames(Aggr).map(addr => Aggr[addr]);
}

function subscribeToDonations(callback) {
  params.contract.events
    .FundsSent({
      fromBlock: "latest"
    })
    .on("data", callback);
}

export default {
  getPastDonations,
  subscribeToDonations,
  getBalance,
  setParams
};

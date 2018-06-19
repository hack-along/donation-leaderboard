import React, { Component } from "react";
import "./App.css";

import { css } from "glamor";

import Web3 from "web3";

import Leaderboard from "./Leaderboard/Leaderboard";

const donationNetworkID = 1; // make sure donations only go through on this network.

const donationAddress = "0x5adf43dd006c6c36506e2b2dfa352e60002d22dc"; //replace with the address to watch
const deploymentBlock = "4448139";
const leaderboardType = "leaderboard"; // can be a "leaderboard" or "multisig"

var myweb3;

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ethlist: [],
      searchTerm: "",
      donateenabled: true,
      socketconnected: false,
      totalAmount: 0
    };
  }

  onSearchChange = event => {
    this.setState({
      searchTerm: event.target.value
    });
  };

  handleDonate = event => {
    event.preventDefault();
    const form = event.target;
    let donateWei = new myweb3.utils.BN(
      myweb3.utils.toWei(form.elements["amount"].value, "ether")
    );
    let message = myweb3.utils.toHex(form.elements["message"].value);
    let extraGas = form.elements["message"].value.length * 68;

    myweb3.eth.net.getId().then(netId => {
      switch (netId) {
        case 1:
          console.log("Metamask is on mainnet");
          break;
        case 2:
          console.log("Metamask is on the deprecated Morden test network.");
          break;
        case 3:
          console.log("Metamask is on the ropsten test network.");
          break;
        case 4:
          console.log("Metamask is on the Rinkeby test network.");
          break;
        case 42:
          console.log("Metamask is on the Kovan test network.");
          break;
        default:
          console.log("Metamask is on an unknown network.");
      }
      if (netId === donationNetworkID) {
        return myweb3.eth.getAccounts().then(accounts => {
          return myweb3.eth
            .sendTransaction({
              from: accounts[0],
              to: donationAddress,
              value: donateWei,
              gas: 150000 + extraGas,
              data: message
            })
            .catch(e => {
              console.log(e);
            });
        });
      } else {
        console.log("no donation allowed on this network");
        this.setState({
          donateenabled: false
        });
      }
    });
  };

  processEthList = ethlist => {
    // let totalAmount = new myweb3.utils.BN(0);
    let filteredEthList = ethlist
      .map(obj => {
        obj.value = new myweb3.utils.BN(obj.value); // convert string to BigNumber
        return obj;
      })
      .filter(obj => {
        return obj.value.cmp(new myweb3.utils.BN(0));
      }) // filter out zero-value transactions
      .reduce((acc, cur) => {
        // group by address and sum tx value
        if (cur.isError !== "0") {
          // tx was not successful - skip it.
          return acc;
        }
        if (cur.from === donationAddress) {
          // tx was outgoing - don't add it in
          return acc;
        }
        if (typeof acc[cur.from] === "undefined") {
          acc[cur.from] = {
            from: cur.from,
            value: new myweb3.utils.BN(0),
            input: cur.input,
            hash: []
          };
        }
        acc[cur.from].value = cur.value.add(acc[cur.from].value);
        acc[cur.from].input =
          cur.input !== "0x" && cur.input !== "0x00"
            ? cur.input
            : acc[cur.from].input;
        acc[cur.from].hash.push(cur.hash);
        return acc;
      }, {});
    filteredEthList = Object.keys(filteredEthList)
      .map(val => filteredEthList[val])
      .sort((a, b) => {
        // sort greatest to least
        return b.value.cmp(a.value);
      })
      .map((obj, index) => {
        // add rank
        obj.rank = index + 1;
        return obj;
      });
    const ethTotal = filteredEthList.reduce((acc, cur) => {
      return acc.add(cur.value);
    }, new myweb3.utils.BN(0));
    return this.setState({
      ethlist: filteredEthList,
      totalAmount: parseFloat(myweb3.utils.fromWei(ethTotal)).toFixed(2)
    });
  };

  componentDidMount = () => {
    if (
      typeof window.web3 !== "undefined" &&
      typeof window.web3.currentProvider !== "undefined"
    ) {
      myweb3 = new Web3(window.web3.currentProvider);
      myweb3.eth.defaultAccount = window.web3.eth.defaultAccount;
      this.setState({
        candonate: true
      });
    } else {
      // I cannot do transactions now.
      this.setState({
        candonate: false
      });
      myweb3 = new Web3();
    }
  };

  render = () => {
    const candonate = this.state.candonate;

    const responsiveness = css({
      "@media(max-width: 700px)": {
        flexWrap: "wrap"
      }
    });

    const hiddenOnMobile = css({
      "@media(max-width: 700px)": {
        display: "none"
      }
    });

    return (
      <div className="App container-fluid">
        <div
          {...responsiveness}
          className="flex-row d-flex justify-content-around"
        >
          <div className="flex-column introColumn">
            <img
              src="/img/placeholder-banner.svg"
              className="typelogo img-fluid"
              alt="Banner Placeholder"
            />
            <div className="introContainer">
              <h1>Donation Leaderboard</h1>
              <p>To deploy your own leaderboard:</p>
              <ol>
                <li>
                  1 - Star and fork the
                  <a href="https://github.com/giveth/donation-leaderboard">
                    {" "}
                    Donation Leaderboard on GitHub/Giveth
                  </a>
                  on your own repository
                </li>
                <li>
                  2 - Get your own API key from{" "}
                  <a href="https://etherscan.io">etherscan.io</a>
                </li>
                <li>
                  3 - Change the <strong>donationAddress</strong> and{" "}
                  <strong>apiKey</strong> variables in your /src/App.js file
                </li>
                <li>
                  4 - Replace placeholder images for <strong>banner</strong> and{" "}
                  <strong>QR code</strong> in public/img and also in your
                  /src/App.js file
                </li>
              </ol>
              <h4>
                {`Made with <3 by the Unicorns at `}
                <a href="https://giveth.io">Giveth</a>
              </h4>
              <p>
                This page uses the Giveth Donation address. By donating you
                support open source projects like this one.{" "}
                <a href="https://giveth.io/donate/">More Info</a>
              </p>
            </div>
          </div>

          <div className="flex-column donationColumn">
            <img
              src="/img/ways-to-donate.svg"
              className="typelogo img-fluid"
              alt="donate"
            />
            {candonate ? (
              <div>
                <h4 {...hiddenOnMobile}>
                  Publicly: Send a transaction via Metamask with your Team Name
                  as a message{" "}
                </h4>

                <form {...hiddenOnMobile} onSubmit={this.handleDonate}>
                  <input
                    type="text"
                    placeholder="ETH to donate"
                    name="amount"
                  />
                  <input type="text" placeholder="message" name="message" />
                  <button className="btn btn-primary">Send</button>
                </form>
              </div>
            ) : (
              <br />
            )}
            <hr />
            <h4>Privately: Send directly to the donation address</h4>
            <img
              src="/img/placeholder-qr.svg"
              className="qr-code"
              alt="qr-code"
            />
            <div className="word-wrap">
              <strong>{donationAddress}</strong>
            </div>
          </div>
        </div>

        <div className="flex-column leaderboard">
          <Leaderboard
            address={donationAddress}
            deploymentBlock={deploymentBlock}
            type={leaderboardType}
          />
        </div>
      </div>
    );
  }; // End of render()
} // End of class App extends Component

export default App;

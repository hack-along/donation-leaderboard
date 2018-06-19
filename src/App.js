import React, { Component } from "react";
import "./App.css";

import { css } from "glamor";

import Web3 from "web3";

import Collapsible from "react-collapsible";
import Emojify from "react-emojione";
var FontAwesome = require("react-fontawesome");

const donationNetworkID = 1; // make sure donations only go through on this network.

const donationAddress = "0x5adf43dd006c6c36506e2b2dfa352e60002d22dc"; //replace with the address to watch
const apiKey = "6DIUB7X6S92YJR6KXKF8V8ZU55IXT5PN2S"; //replace with your own key

const etherscanApiLinks = {
  extTx:
    "https://api.etherscan.io/api?module=account&action=txlistinternal&address=" +
    donationAddress +
    "&startblock=0&endblock=99999999&sort=asc&apikey=" +
    apiKey,
  intTx:
    "https://api.etherscan.io/api?module=account&action=txlist&address=" +
    donationAddress +
    "&startblock=0&endblock=99999999&sort=asc&apikey=" +
    apiKey
};

const isSearched = searchTerm => item =>
  item.from.toLowerCase().includes(searchTerm.toLowerCase());

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

  subscribe = address => {
    let ws = new WebSocket("wss://socket.etherscan.io/wshandler");

    function pinger(ws) {
      var timer = setInterval(function() {
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              event: "ping"
            })
          );
        }
      }, 20000);
      return {
        stop: function() {
          clearInterval(timer);
        }
      };
    }

    ws.onopen = function() {
      this.setState({
        socketconnected: true
      });
      pinger(ws);
      ws.send(
        JSON.stringify({
          event: "txlist",
          address: address
        })
      );
    }.bind(this);
    ws.onmessage = function(evt) {
      let eventData = JSON.parse(evt.data);
      console.log(eventData);
      if (eventData.event === "txlist") {
        let newTransactionsArray = this.state.transactionsArray.concat(
          eventData.result
        );
        this.setState(
          {
            transactionsArray: newTransactionsArray
          },
          () => {
            this.processEthList(newTransactionsArray);
          }
        );
      }
    }.bind(this);
    ws.onerror = function(evt) {
      this.setState({
        socketerror: evt.message,
        socketconnected: false
      });
    }.bind(this);
    ws.onclose = function() {
      this.setState({
        socketerror: "socket closed",
        socketconnected: false
      });
    }.bind(this);
  };

  getAccountData = () => {
    let fetchCalls = [
      fetch(`${etherscanApiLinks.extTx}`),
      fetch(`${etherscanApiLinks.intTx}`)
    ];
    return Promise.all(fetchCalls)
      .then(res => {
        return Promise.all(res.map(apiCall => apiCall.json()));
      })
      .then(responseJson => {
        return [].concat.apply(...responseJson.map(res => res.result));
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

    this.getAccountData().then(res => {
      this.setState(
        {
          transactionsArray: res
        },
        () => {
          this.processEthList(res);
          this.subscribe(donationAddress);
        }
      );
    });
  };

  render = () => {
    const candonate = this.state.candonate;

    const responsiveness = css({
      "@media(max-width: 700px)": {
        "flex-wrap": "wrap"
      }
    });

    const hiddenOnMobile = css({
      "@media(max-width: 700px)": {
        display: "none"
      }
    });

    const maxOnMobile = css({
      "@media(max-width: 700px)": {
        maxWidth: "100%"
      }
    });

    return (
      <div className="App container-fluid">
        <header id="header">
          <nav className="navbar navbar-expand-lg navbar-dark fixed-top navbar-color">
            <a className="navbar-brand" href="../#">
              <img
                src="/img/giveth-typelogo-white.svg"
                width="100px"
                height="auto"
                alt=""
              />
            </a>
            <button
              className="navbar-toggler"
              type="button"
              data-toggle="collapse"
              data-target="#navbarSupportedContent"
              aria-controls="navbarSupportedContent"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon" />
            </button>

            <div
              className="collapse navbar-collapse"
              id="navbarSupportedContent"
            >
              <ul className="navbar-nav mr-auto">
                <li className="nav-item">
                  <a className="nav-link" href="#team">
                    Donate
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="#team">
                    Team
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="#benefits">
                    Benefits
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="#instructions">
                    Instructions
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="#faq">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </header>

        <main className="container-fluid background-white-transparent">
          <section id="donation-hero">
            <div className="flex-row justify-content-center">
              <div className="flex-column justify-content-center color-white">
                <h1 className="display-3">
                  Help us Build the Future of Giving
                </h1>

                <div className="flex-column d-flex justify-content-center">
                  <a
                    className="btn btn-secondary color-purple"
                    href="https://www.mycrypto.com/?to=0x5ADF43DD006c6C36506e2b2DFA352E60002d22Dc&gaslimit=23000#send-transaction"
                  >
                    Donate <i className="fab fa-ethereum" /> directly
                    <br />
                    via MyCrypto
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section id="donations" className="background-white">
            <ul className="flex-row d-flex features flex-wrap justify-content-around">
              <li id="team" className="text-block">
                <h3>Who are we?</h3>
                <p>
                  We are the Community building the Giveth Donation Application,{" "}
                  <a href="https://giveth.io">the platform</a>. Our system will
                  make it possible for nonprofits and individuals to unite and
                  make the world a better place, by enabling full transparency
                  and accountability towards Givers.
                </p>
                <p>
                  We are the primordial Decentralized Altruistic Community
                  (DAC), we are the Giveth Unicorns, the first users of our own
                  platform and as every DAC, we need Givers to support us. You
                  could be this Giver.
                </p>
              </li>
              <li id="etherglade" className="text-block">
                <h3>Why donate to Giveth?</h3>
                <p>
                  As opposed to traditional charity, with Giveth every donation
                  and pledge is transparent, so you always know{" "}
                  <strong>exactly</strong> where your donation went and get a
                  good sense of the impact it made in direct communication with
                  your beneficiary.
                </p>
              </li>
              <li id="benefits" className="text-block">
                <h3>Benefits</h3>
                <div className="flex-column">
                  <div className="flex-row d-flex">
                    <FontAwesome
                      name="pied-piper"
                      size="2x"
                      className="fa-fw"
                    />
                    <p>
                      You automatically become a part of the Giveth DAC, you are
                      a <strong>Unicorn</strong> now!
                    </p>
                  </div>
                  <div className="flex-row d-flex">
                    <img
                      src="/img/ethereum.svg"
                      width="auto"
                      height="46px"
                      alt=""
                    />
                    <p>
                      You are entitled to <strong>Giveth Tokens</strong> (see{" "}
                      <a href="#faq">FAQ</a>)
                    </p>
                  </div>
                  <div className="flex-row d-flex">
                    <FontAwesome name="comments" size="2x" className="fa-fw" />
                    <p>
                      You get added to our dedicated{" "}
                      <strong>Givers channel</strong> on{" "}
                      <a href="../join/">Riot and Slack</a>
                    </p>
                  </div>
                  <div className="flex-row d-flex">
                    <FontAwesome name="bolt" size="2x" className="fa-fw" />{" "}
                    <p>
                      You are <span>in control</span> - decide to give to our
                      DAC or directly to a specific Campaign or Milestone<sup>
                        <a href="#footnotes">3</a>
                      </sup>
                    </p>
                  </div>
                  <div className="flex-row d-flex">
                    <FontAwesome name="eye" size="2x" className="fa-fw" />
                    <p>
                      You get a fully transparent insight in our organization,
                      finances and can hold us <strong>accountable</strong> for
                      decisions<sup>
                        <a href="#footnotes">2</a>
                      </sup>
                    </p>
                  </div>
                </div>
              </li>
            </ul>
            <div className="row d-flex">
              <section className="flex-column d-flex m-auto justify-content-center card-green alternatives-style">
                <h3 className="color-white">Other ways to donate</h3>
                <ol>
                  <li>
                    1. Donate <i className="fab fa-ethereum" /> directly via
                    MyCrypto
                    <br />
                    <br />
                    <div className="flex-column d-flex justify-content-center">
                      <a
                        className="btn btn-secondary m-auto"
                        href="https://www.mycrypto.com/?to=0x5ADF43DD006c6C36506e2b2DFA352E60002d22Dc&gaslimit=23000#send-transaction"
                      >
                        Donate
                      </a>
                    </div>
                  </li>
                  <hr />
                  <li>
                    2. Send ETH or any ERC20 token via your wallet to our
                    <br />
                    ETH Donation Address 'revolution.eth', which resolves to
                    <div className="word-wrap">
                      0x5ADF43DD006c6C36506e2b2DFA352E60002d22Dc
                    </div>
                  </li>
                  <hr />
                  <li>
                    3. Send BTC to our BTC Donation Address<sup>
                      <a href="#footnotes">1</a>
                    </sup>
                    <div className="word-wrap">
                      3Q3eCqvwk2JPocfMBfC6oS5iA9S9wDXgYA
                    </div>
                  </li>
                  <hr />
                  <li>
                    4. Send virtually any altcoin to us via Shapeshift<sup>
                      <a href="#footnotes">1</a>
                    </sup>
                    <div className="flex-column d-flex justify-content-center padding-top">
                      GET BACK SHAPESHIFT
                    </div>
                  </li>
                </ol>
              </section>

              <div id="footnotes" className="col-md-6 m-auto">
                <a href="https://leaderboard.giveth.io">
                  <h3 className="padding-top padding-bottom ">
                    Take a look at our donation leaderboard and put a name to
                    your donation!
                  </h3>
                </a>
                <hr />
                <p>
                  <em>
                    <sup>1</sup> We accept ETH, BTC and any Ethereum based
                    tokens directly, but if you donate ETH from MEW, Metamask,
                    Mist or Parity you'll receive Giveth Governance Tokens (GGT)
                    in return! GGT will become part of our decentralized
                    governance system - ask us on Slack or Riot if you have any
                    doubts.
                  </em>
                </p>
                <p>
                  <em>
                    <sup>2</sup> This is possible as soon we open up our DApp to
                    the wider audience. In the meantime you can simply tell us
                    and we will make it so!
                  </em>
                </p>
                <p>
                  <em>
                    <sup>3</sup> The Giveth DAC gathers during a weekly
                    ‘Governance Meeting.’ This meeting is{" "}
                    <a href="https://www.youtube.com/channel/UCdqmP4axeI1hNmX20aZsOwg">
                      streamed on youtube
                    </a>{" "}
                    and Givers are{" "}
                    <a href="http://join.giveth.io">very welcome to attend</a>{" "}
                    and provide feedback. We promise you full transparency and
                    as long as funds are not locked in a specific Campaign you
                    can revoke your donation.
                  </em>
                </p>
              </div>
            </div>
          </section>

          <section
            id="faq"
            className="background-white padding-top padding-bottom community-row"
          >
            <h3>Frequently Asked Questions</h3>
            <ul className="flex-row d-flex features">
              <li>
                <h5>Is Giveth recognized as an official charity? </h5>
                <p>
                  Giveth is a
                  <a href="https://medium.com/giveth/giveth-introduces-decentralized-altruistic-communities-dacs-d1155a79bdc4">
                    Decentralized Altruistic Community
                  </a>
                  and is not a registered as a charitable entity, we are however
                  registered on the blockchain ;-) We are a community-led
                  project and will not derive any direct profit from the
                  platform. We strive to
                  <a href="https://wiki.giveth.io/dac/about/">
                    model the DAC concept{" "}
                  </a>
                  as one of the first not-for-profit blockchain based entities.
                  We guarantee all funds will get recycled back into the
                  Community that is ensuring the Giveth Platform gets adopted
                  widely.
                </p>
              </li>
              <li>
                <h5>What is the roadmap for the Giveth Platform? </h5>
                <p>
                  The roadmap for the Giveth DApp can be found{" "}
                  <a href="https://wiki.giveth.io/documentation/DApp/product-roadmap/">
                    here
                  </a>.
                  <br />
                  As a Giver you can also ask us for an exclusive tour of the
                  DApp in which The Giveth DAC, Campaigns plus Milestones are
                  visible. These are updated continuously.
                </p>
              </li>
              <li>
                <h5>
                  I still need more detail on how Giveth works, where can I find
                  this?{" "}
                </h5>
                <p>
                  You can read a{" "}
                  <a href="https://medium.com/giveth/what-is-the-future-of-giving-d50446b0a0e4">
                    general overview
                  </a>{" "}
                  of how the Donation Application works or read more about it in
                  our{" "}
                  <a href="https://wiki.giveth.io/documentation/product-definition/">
                    product definition
                  </a>. If you want to discover our other activities, do browse
                  our Wiki or reach out to us on{" "}
                  <a href="../join">Slack or Riot!</a>
                </p>
              </li>
              <li>
                <h5>
                  How do the Giveth Governance Tokens work and how do I get
                  these?{" "}
                </h5>
                <p>
                  We accept ETH, BTC and any Ethereum based tokens directly, but
                  if you donate ETH from MEW, Metamask, Mist or Parity you'll
                  receive Giveth Governance Tokens (GGT) in return!
                  <br />
                  When you donate you receive Giveth Governance Tokens, which
                  will be{" "}
                  <a href="https://medium.com/giveth/what-is-the-future-of-giving-d50446b0a0e4">
                    in control of the platform
                  </a>{" "}
                  once we are full on decentralized. Contact us on{" "}
                  <a href="../join">Slack or Riot</a> if you have any doubts.
                </p>
              </li>
              <li>
                <h5>
                  Where can I see in detail what you are spending donations on?{" "}
                </h5>
                <p>
                  One of the core values of Giveth is transparency. We invite
                  everyone to have a look at our{" "}
                  <a href="https://wiki.giveth.io/dac/finances/">finances</a>.
                  <br />
                  As a Giver you can also ask us for an exclusive tour of the
                  DApp in which The Giveth DAC, Campaigns plus Milestones ànd
                  the funds linked to these are visible onto a very granular
                  level. In the near future access to the DApp will be opened up
                  to the wider public.
                </p>
              </li>
              <li>
                <h5>
                  I like your project but right now I have no funds to donate,
                  how else can I contribute?{" "}
                </h5>
                <p>
                  We are a very inclusive Community and would love your help, in
                  any way possible,{" "}
                  <a href="../join">just join and come talk to us!</a> We even
                  have a special channel for you: #contributors.
                  <br />Oh, and one more thing. If you hold any cryptocurrency,
                  you know that securing your keys is paramount. The Giveth core
                  team uses the Ledger Nano S and by ordering yours via this{" "}
                  <a href="https://www.ledgerwallet.com/r/d663?path=/products/ledger-nano-s">
                    link
                  </a>{" "}
                  Giveth will receive a donation worth 15% of the cost. Protect
                  yourself and support our cause!
                </p>
              </li>
            </ul>
          </section>
        </main>

        <div
          {...responsiveness}
          className="flex-row d-flex justify-content-around background-color first"
        >
          <div
            {...responsiveness}
            className="flex-row d-flex middleBlock justify-content-around"
          >
            <div
              {...maxOnMobile}
              className="flex-column justify-content-center donationColumn"
            >
              <h1>
                Ways to <span className="special">Donate</span>
              </h1>
              <p>
                Development for DAppNode is exclusively done in an open-source
                fashion. You can donate directly to development via MetaMask or
                sending ETH to the donation address.
              </p>
              {candonate ? (
                <div>
                  <h6 {...hiddenOnMobile}>
                    Publicly: Send a transaction via Metamask with your Name as
                    a message{" "}
                  </h6>

                  <form {...hiddenOnMobile} onSubmit={this.handleDonate}>
                    <input
                      type="text"
                      placeholder="ETH to donate"
                      name="amount"
                    />
                    <input type="text" placeholder="Message" name="message" />
                    <button className="btn btn-light">Send</button>
                  </form>
                </div>
              ) : (
                <br />
              )}
            </div>
            <div
              {...maxOnMobile}
              className="flex-column justify-content-center donationColumn"
            >
              <h6>Privately: Send directly to the donation address</h6>
              <img
                src="/img/giveth-qr.svg"
                className="qr-code"
                alt="Donation QR Code"
              />
              <div className="word-wrap">
                <strong className="color-main-accent">{donationAddress}</strong>
              </div>
            </div>
          </div>
        </div>
        <div {...responsiveness} className="flex-row d-flex amount bg-blue">
          <div className="flex-column margin">
            <strong>Amount donated </strong>
            <h3 className="color-main-accent">{this.state.totalAmount} ETH</h3>
          </div>
          <div className="flex-column margin">
            <form className="Search">
              <input
                type="text"
                onChange={this.onSearchChange}
                placeholder="filter leaderboard"
              />
            </form>
          </div>
        </div>

        <div
          {...responsiveness}
          className="flex-row d-flex justify-content-around"
        >
          <div className="flex-column leaderboard">
            <Collapsible trigger="Hide the leaderboard" open>
              <table className="table">
                <thead className="pagination-centered">
                  <tr>
                    <th>Rank</th>
                    <th>Address</th>
                    <th>Value</th>
                    <th>Message</th>
                    <th>Tx Link</th>
                  </tr>
                </thead>
                <tbody>
                  {this.state.ethlist
                    .filter(isSearched(this.state.searchTerm))
                    .map(item => (
                      <tr key={item.hash} className="Entry">
                        <td>{item.rank} </td>
                        <td>{item.from} </td>
                        <td>{myweb3.utils.fromWei(item.value)} ETH</td>
                        <td>
                          <Emojify>
                            {item.input.length &&
                              myweb3.utils.hexToAscii(item.input)}
                          </Emojify>
                        </td>
                        <td className="table-tx-header">
                          {item.hash.map((txHash, index) => (
                            <a
                              key={index}
                              href={"https://etherscan.io/tx/" + txHash}
                            >
                              [{index + 1}]
                            </a>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Collapsible>
          </div>
        </div>

        <footer id="footer" className="container-fluid background-black">
          <ul className="col d-flex justify-content-center hide-list-style flex-wrap">
            <li>
              <a href="https://medium.com/giveth">
                <FontAwesome name="medium" size="2x" className="social" />
              </a>
            </li>

            <li>
              <a href="https://giveth.io/join">
                <FontAwesome name="comments" size="2x" className="social" />
              </a>
            </li>

            <li>
              <a href="https://twitter.com/givethio">
                <FontAwesome name="twitter" size="2x" className="social" />{" "}
              </a>
            </li>

            <li>
              <a href="https://github.com/giveth">
                <FontAwesome name="github" size="2x" className="social" />{" "}
              </a>
            </li>

            <li>
              <a href="https://reddit.com/r/giveth">
                <FontAwesome name="reddit" size="2x" className="social" />{" "}
              </a>
            </li>

            <li>
              <a href="https://www.facebook.com/givethio/">
                <FontAwesome name="facebook" size="2x" className="social" />{" "}
              </a>
            </li>

            <li>
              <a href="https://www.youtube.com/givethio">
                <FontAwesome name="youtube" size="2x" className="social" />{" "}
              </a>
            </li>
          </ul>
          <span>
            Support us with your Donation:{" "}
            <a className="donation-link" href="https://giveth.io/donate/">
              revolution.eth
            </a>
          </span>
          <h6 className="color-white padding-top">
            MMXVIII - No Rights Reserved - <a href="/world/">The Giveth DAC</a>
          </h6>
        </footer>
      </div>
    );
  }; // End of render()
} // End of class App extends Component

export default App;

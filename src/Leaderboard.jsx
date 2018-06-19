import React, { Component } from "react";
import API from "./API";
import Emojify from "react-emojione";
import "./loader.css";

// Copy paste the contract address and ABI

export default class Leaderboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ethlist: []
    };
    this.getDonations = this.getDonations.bind(this);
  }

  getDonations() {
    API.getPastDonations().then(ethlist => {
      this.setState({ ethlist });
    });
  }

  componentDidMount = () => {
    if (!this.props.address) throw Error("You must provide an address prop");
    if (!this.props.deploymentBlock)
      console.warn(
        "Not providing the deployment block may slow significantly the loading process. Go to etherscan.io/address/" +
          this.props.address +
          " and find the block at which the contract was created"
      );
    if (!this.props.type)
      throw Error(
        "You must provide a type prop. Possible values are: leaderboard or multisig. Go to etherscan.io/address/" +
          this.props.address +
          " and by reading the contract code find what type it is"
      );
    // Pass parameters to the API
    API.setParams({
      address: this.props.address,
      deploymentBlock: this.props.deploymentBlock,
      type: this.props.type
    });
    // Call the API
    this.getDonations();
    // Subscribe to futur donations
    API.subscribeToDonations(() => {
      this.getDonations();
    });
  };

  render() {
    let totalAmount = 0;

    const rows = this.state.ethlist
      .sort((a, b) => b.value - a.value)
      .map((tx, i) => {
        totalAmount += tx.value;
        const linkList = tx.links.map((link, j) => (
          <a key={j} href={link}>
            [{j + 1}]
          </a>
        ));
        return (
          <tr key={i} className="Entry">
            <td>{i + 1} </td>
            <td>{tx.address} </td>
            <td>{tx.value} ETH</td>
            <td>
              <Emojify>{tx.message}</Emojify>
            </td>
            <td>{linkList}</td>
          </tr>
        );
      });

    if (!this.state.ethlist.length) {
      return (
        <div className="flex-row d-flex amount">
          <div className="flex-column margin">
            <h3>Loading donations...</h3>
            <div className="spinner">
              <div className="bounce1" />
              <div className="bounce2" />
              <div className="bounce3" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex-row d-flex amount">
          <div className="flex-column margin">
            <strong>Amount donated </strong>
            <h3>{totalAmount.toFixed(2)} ETH</h3>
          </div>
        </div>
        <div className="flex-column leaderboard">
          <table className="table">
            <thead className="pagination-centered">
              <tr>
                <th>Rank</th>
                <th>Address</th>
                <th>Value</th>
                <th>Message</th>
                <th>Donations</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

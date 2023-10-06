import React, { useState, useEffect, useContext } from "react";
import Web3Modal from "web3modal";
//import { ethers } from "ethers";
import Router from "next/router";
import axios from "axios";
import { create as ipfsHttpClient } from "ipfs-http-client";

const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0"); // Not my API key account (Infura)

// INTERNAL IMPORT
import { NFTMarketplaceAddress, NFTMarketplaceABI } from "./constants";

const { ethers } = require("ethers");

//----FETCHING SMART CONTRACT
const fetchContract = (signerOrProvider) =>
  new ethers.Contract(
    NFTMarketplaceAddress,
    NFTMarketplaceABI,
    signerOrProvider
  );

//-----CONNECTING WITH SMART CONTRACT
const connectingWithSmartContract = async () => {
  try {
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = fetchContract(signer);
    return contract;
  } catch (error) {
    console.log(error);
    console.log("Something went wrong while connecting with the contract");
  }
};

export const NFTMarketplaceContext = React.createContext();

export const NFTMarketplaceProvider = ({ children }) => {
  const titleData = "Discover, collect, and sell NFTs";

  //-----------USESTATE
  const [currentAccount, setCurrentAccount] = useState("");

  //---------CHECK IF THE WALLET IS CONNECTED
  const checkIfWalletConnected = async () => {
    try {
      if (!window.ethereum) return console.log("Install Metamask");

      const accounts = await window.ethereum({ method: "eth_accounts" });

      if (accounts.length) {
        setCurrentAccount(accounts[0]);
      } else {
        console.log("No Account Found");
      }
    } catch (error) {
      console.log("Something wrong while connecting to wallet");
    }
  };

  useEffect(() => {
    checkIfWalletConnected();
  }, []);

  //----------CONNECT WALLET FUNCTION
  const connectWallet = async () => {
    try {
      if (!window.ethereum) return console.log("Install Metamask");

      const accounts = await window.ethereum({ method: "eth_requestAccount" });

      setCurrentAccount(accounts[0]);
      window.location.reload();
    } catch (error) {
      console.log("Error while connecting to Wallet");
    }
  };

  //--------------UPLOAD TO IPFS FUNCTION
  const uploadToIPFS = async (file) => {
    try {
      const added = await client.add({ content: file });
      const url = "https://ipfs.infura.io/ipfs/${added.path}";
      return url;
    } catch (error) {
      console.log("Error uploading to IPFS");
    }
  };

  //---------------CREATE NFT FUNCTION
  const createNFT = async (formInput, fileUrl, router) => {
    const { name, description, price } = formInput;

    if (!name || !description || !price || !fileUrl)
      return console.log("Data Missing");

    const data = JSON.stringify({ name, description, image: fileUrl });

    try {
      const added = await client.add(data);

      const url = "http://ipfs.infura.io/ipfs/${added.path}";

      await createSale(url, price);
    } catch (error) {
      console.log(error);
    }
  };

  //---------CREATE SALE
  const createSale = async (url, formInputPrice, isReselling, id) => {
    try {
      const price = ethers.utils.parseUnits(formInputPrice, "ether");
      const contract = await connectingWithSmartContract();

      const listingPrice = await contract.getListingPrice();

      const transaction = !isReselling
        ? await contract.createToken(url, price, {
            value: listingPrice.toString(),
          })
        : await contract.reSellToken(url, price, {
            value: listingPrice.toString(),
          });

      await transaction.wait();
    } catch (error) {
      console.log("Error while creating NFT sale");
    }
  };

  //--------FETCH NFTS FUNCTION
  const fetchNFTs = async () => {
    try {
      const provider = new ethers.providers.JsonRpcProvider();
      const contract = fetchContract(provider);

      const data = await contract.fetchMarketItem();
      // console.log(data);

      const items = await Promise.all(
        data.map(
          async ({ tokenId, seller, owner, price: unformattedPrice }) => {
            const tokenURI = await contract.tokenURI(tokenId);

            const {
              data: { image, anme, description },
            } = await axios.get(tokenURI);
            const price = ethers.utils.formatUnits(
              unformattedPrice.toString(),
              "ether"
            );

            return {
              price,
              tokenId: tokenId.toNumber(),
              seller,
              owner,
              image,
              name,
              description,
              tokenURI,
            };
          }
        )
      );

      return items;
    } catch (error) {
      console.log("Error while fetching NFTs");
    }
  };

  //-----------FETCHING MY NFTs OR LISTED NFTs
  const fetchMyNFTsOrListedNFTs = async (type) => {
    try {
    } catch (error) {}
  };

  return (
    <NFTMarketplaceContext.Provider
      value={{ connectWallet, uploadToIPFS, createNFT, fetchNFTs, titleData }}
    >
      {children}
    </NFTMarketplaceContext.Provider>
  );
};

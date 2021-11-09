import BigNumber from "bignumber.js";
import { DRE, increaseTime } from "../helpers/misc-utils";
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { makeSuite } from "./helpers/make-suite";

const chai = require("chai");

const { expect } = chai;

makeSuite("DataProvider", (testEnv) => {
  before("set config", () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
  });

  after("reset config", () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("Borrows WETH using 1 BAYC", async () => {
    const { users, pool, reserveOracle, weth, bayc, dataProvider, uiProvider, walletProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //Depositor mints WETH
    await weth.connect(depositor.signer).mint(await convertToCurrencyDecimals(weth.address, "1000"));

    //Depositor approve protocol to access depositor wallet
    await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Depositor deposits 1000 WETH
    const amountDeposit = await convertToCurrencyDecimals(weth.address, "1000");

    await pool.connect(depositor.signer).deposit(weth.address, amountDeposit, depositor.address, "0");

    //Borrower mints BAYC
    await bayc.connect(borrower.signer).mint("101");
    await bayc.connect(borrower.signer).mint("102"); // for data provider test case

    //Borrower approve protocol to access borrower wallet
    await bayc.connect(borrower.signer).setApprovalForAll(pool.address, true);

    //Borrower borrows
    const loanDataBefore = await pool.getNftLoanData(bayc.address, "101");

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);

    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(loanDataBefore.availableBorrowsETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.5)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(weth.address, amountBorrow.toString(), bayc.address, "101", borrower.address, "0");
  });

  it("Query UI Reserve Data", async () => {
    const { users, addressesProvider, weth, uiProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    {
      const reservesList = await uiProvider.getReservesList(addressesProvider.address);
      expect(reservesList).to.include(weth.address);
    }

    {
      const simpleReservesData = await uiProvider.getSimpleReservesData(addressesProvider.address);
      const wethData = simpleReservesData[0].find((reserveData) => {
        if (reserveData.underlyingAsset === weth.address) {
          return reserveData;
        }
      });
      //console.log("simpleReservesData", simpleReservesData);
      expect(wethData?.isActive).to.be.equal(true);
      expect(wethData?.totalScaledVariableDebt).to.be.gt(0);
    }

    {
      const userReservesData = await uiProvider.getUserReservesData(addressesProvider.address, borrower.address);
      const userWethData = userReservesData[0].find((userReserveData) => {
        if (userReserveData.underlyingAsset === weth.address) {
          return userReserveData;
        }
      });
      //console.log("userReservesData", userReservesData);
      expect(userWethData?.scaledVariableDebt).to.be.gt(0);
    }

    {
      const aggReservesData = await uiProvider.getReservesData(addressesProvider.address, borrower.address);
      const aggWethData = aggReservesData[0].find((reserveData) => {
        if (reserveData.underlyingAsset === weth.address) {
          return reserveData;
        }
      });
      //console.log("aggReservesData", aggReservesData);
      expect(aggWethData?.isActive).to.be.equal(true);
      expect(aggWethData?.totalScaledVariableDebt).to.be.gt(0);
      const aggUserWethData = aggReservesData[1].find((userReserveData) => {
        if (userReserveData.underlyingAsset === weth.address) {
          return userReserveData;
        }
      });
      expect(aggUserWethData?.scaledVariableDebt).to.be.gt(0);
    }
  });

  it("Query UI NFT Data", async () => {
    const { users, addressesProvider, bayc, uiProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    {
      const nftsList = await uiProvider.getNftsList(addressesProvider.address);
      expect(nftsList).to.include(bayc.address);
    }

    {
      const simpleNftsData = await uiProvider.getSimpleNftsData(addressesProvider.address);
      const baycData = simpleNftsData.find((nftData) => {
        if (nftData.underlyingAsset === bayc.address) {
          return nftData;
        }
      });
      //console.log("simpleNftsData", simpleNftsData);
      expect(baycData?.isActive).to.be.equal(true);
      expect(baycData?.totalCollateral).to.be.gt(0);
    }

    {
      const userNftsData = await uiProvider.getUserNftsData(addressesProvider.address, borrower.address);
      const userBaycData = userNftsData.find((userNftData) => {
        if (userNftData.underlyingAsset === bayc.address) {
          return userNftData;
        }
      });
      //console.log("userNftsData", userNftsData);
      expect(userBaycData?.TotalCollateral).to.be.gt(0);
    }

    {
      const aggNftsData = await uiProvider.getNftsData(addressesProvider.address, borrower.address);
      const aggBaycData = aggNftsData[0].find((nftData) => {
        if (nftData.underlyingAsset === bayc.address) {
          return nftData;
        }
      });
      //console.log("aggNftsData", aggNftsData);
      expect(aggBaycData?.isActive).to.be.equal(true);
      expect(aggBaycData?.totalCollateral).to.be.gt(0);
      const aggUserBaycData = aggNftsData[1].find((userNftData) => {
        if (userNftData.underlyingAsset === bayc.address) {
          return userNftData;
        }
      });
      expect(aggUserBaycData?.TotalCollateral).to.be.gt(0);
    }
  });

  it("Query Wallet Reserve Data", async () => {
    const { users, addressesProvider, weth, bWETH, walletProvider, dataProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    {
      const borrowerBalances = await walletProvider.getUserReservesBalances(
        addressesProvider.address,
        borrower.address
      );
      const assetIndex = borrowerBalances[0].findIndex((asset, index) => {
        if (asset === weth.address) {
          return true;
        }
      });
      expect(assetIndex).to.not.equal(undefined);
      expect(borrowerBalances[1][assetIndex]).to.be.gt(0);

      const tokenData = await dataProvider.getReserveTokenData(borrowerBalances[0][assetIndex]);
      const debtBalance = await walletProvider.balanceOfReserve(borrower.address, tokenData.debtTokenAddress);
      expect(debtBalance).to.be.gt(0); // NFT 101 borrow WETH
    }

    {
      const depositorBalances = await walletProvider.getUserReservesBalances(
        addressesProvider.address,
        depositor.address
      );
      const assetIndex = depositorBalances[0].findIndex((asset, index) => {
        if (asset === weth.address) {
          return true;
        }
      });
      expect(assetIndex).to.not.equal(undefined);
      expect(depositorBalances[1][assetIndex]).to.be.equal(0); // all weth has deposited

      const tokenData = await dataProvider.getReserveTokenData(depositorBalances[0][assetIndex]);
      const bTokenBalance = await walletProvider.balanceOfReserve(depositor.address, tokenData.bTokenAddress);
      expect(bTokenBalance).to.be.gt(0); // all weth has deposited
    }

    {
      const batchBalances = await walletProvider.batchBalanceOfReserve(
        [depositor.address, borrower.address],
        [weth.address, bWETH.address]
      );
      //depositor + weth
      expect(batchBalances[0 * 2 + 0]).to.be.equal(0); // all weth has deposited
      //depositor + bWETH
      expect(batchBalances[0 * 2 + 1]).to.be.gt(0); // all weth has deposited
      //borrower + weth
      expect(batchBalances[1 * 2 + 0]).to.be.gt(0); // NFT 101 borrow eth
      //borrower + bWETH
      expect(batchBalances[1 * 2 + 1]).to.be.equal(0); // not deposit any weth
    }
  });

  it("Query Wallet NFT Data", async () => {
    const { users, addressesProvider, bayc, bBAYC, walletProvider, dataProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    {
      const borrowerBalances = await walletProvider.getUserNftsBalances(addressesProvider.address, borrower.address);
      const assetIndex = borrowerBalances[0].findIndex((asset, index) => {
        if (asset === bayc.address) {
          return true;
        }
      });
      expect(assetIndex).to.not.equal(undefined);
      expect(borrowerBalances[1][assetIndex]).to.be.equal(1); // NFT 102 is not used for borrow

      const tokenData = await dataProvider.getNftTokenData(borrowerBalances[0][assetIndex]);
      const bNftBalance = await walletProvider.balanceOfNft(borrower.address, tokenData.bNftAddress);
      expect(bNftBalance).to.be.equal(1); // NFT 101 has used for borrow
    }

    {
      const depositorBalances = await walletProvider.getUserNftsBalances(addressesProvider.address, depositor.address);
      const assetIndex = depositorBalances[0].findIndex((asset, index) => {
        if (asset === bayc.address) {
          return true;
        }
      });
      expect(assetIndex).to.not.equal(undefined);
      expect(depositorBalances[1][assetIndex]).to.be.equal(0);

      const tokenData = await dataProvider.getNftTokenData(depositorBalances[0][assetIndex]);
      const bNftBalance = await walletProvider.balanceOfNft(depositor.address, tokenData.bNftAddress);
      expect(bNftBalance).to.be.equal(0);
    }

    {
      const batchBalances = await walletProvider.batchBalanceOfNft(
        [depositor.address, borrower.address],
        [bayc.address, bBAYC.address]
      );
      //depositor + bayc
      expect(batchBalances[0 * 2 + 0]).to.be.equal(0); // not mint any NFT
      //depositor + bBAYC
      expect(batchBalances[0 * 2 + 1]).to.be.equal(0); // not mint any NFT
      //borrower + bayc
      expect(batchBalances[1 * 2 + 0]).to.be.equal(1); // NFT 102 not used for borrow
      //borrower + bBAYC
      expect(batchBalances[1 * 2 + 1]).to.be.equal(1); // NFT 101 has used for borrow
    }
  });
});

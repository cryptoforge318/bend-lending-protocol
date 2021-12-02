// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IWETH} from "../interfaces/IWETH.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {IBToken} from "../interfaces/IBToken.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

contract WETHGateway is IERC721Receiver, Ownable, IWETHGateway {
  ILendPoolAddressesProvider internal _addressProvider;
  ILendPool internal _pool;
  ILendPoolLoan internal _poolLoan;

  IWETH internal WETH;

  /**
   * @dev Sets the WETH address and the LendPoolAddressesProvider address. Infinite approves lend pool.
   * @param weth Address of the Wrapped Ether contract
   **/
  constructor(address addressProvider, address weth) {
    _addressProvider = ILendPoolAddressesProvider(addressProvider);
    _pool = ILendPool(_addressProvider.getLendPool());
    _poolLoan = ILendPoolLoan(_addressProvider.getLendPoolLoan());

    WETH = IWETH(weth);

    WETH.approve(address(_pool), type(uint256).max);
  }

  function authorizeLendPoolNFT(address nftAsset) external onlyOwner {
    IERC721(nftAsset).setApprovalForAll(address(_pool), true);
  }

  function depositETH(address onBehalfOf, uint16 referralCode) external payable override {
    WETH.deposit{value: msg.value}();
    _pool.deposit(address(WETH), msg.value, onBehalfOf, referralCode);
  }

  function withdrawETH(uint256 amount, address to) external override {
    IBToken bWETH = IBToken(_pool.getReserveData(address(WETH)).bTokenAddress);

    uint256 userBalance = bWETH.balanceOf(msg.sender);
    uint256 amountToWithdraw = amount;

    // if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == type(uint256).max) {
      amountToWithdraw = userBalance;
    }

    bWETH.transferFrom(msg.sender, address(this), amountToWithdraw);
    _pool.withdraw(address(WETH), amountToWithdraw, address(this));
    WETH.withdraw(amountToWithdraw);
    _safeTransferETH(to, amountToWithdraw);
  }

  function borrowETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    require(address(onBehalfOf) != address(0), "WETHGateway: `onBehalfOf` should not be zero");

    IERC721(nftAsset).safeTransferFrom(msg.sender, address(this), nftTokenId);
    _pool.borrow(address(WETH), amount, nftAsset, nftTokenId, onBehalfOf, referralCode);
    WETH.withdraw(amount);
    _safeTransferETH(onBehalfOf, amount);
  }

  function repayETH(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external payable override returns (uint256, bool) {
    uint256 loanId = _poolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId > 0, "collateral loan id not exist");

    uint256 repayDebtAmount = _poolLoan.getLoanReserveBorrowAmount(loanId);
    if (amount < repayDebtAmount) {
      repayDebtAmount = amount;
    }

    require(msg.value >= repayDebtAmount, "msg.value is less than repayment amount");

    WETH.deposit{value: repayDebtAmount}();
    (uint256 paybackAmount, bool burn) = _pool.repay(nftAsset, nftTokenId, amount);

    // refund remaining dust eth
    if (msg.value > repayDebtAmount) {
      _safeTransferETH(msg.sender, msg.value - repayDebtAmount);
    }

    return (paybackAmount, burn);
  }

  function auctionETH(
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf
  ) external payable override {
    WETH.deposit{value: msg.value}();
    _pool.auction(nftAsset, nftTokenId, msg.value, onBehalfOf);
  }

  function liquidateETH(
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf
  ) external payable override {
    onBehalfOf;

    _pool.liquidate(nftAsset, nftTokenId, onBehalfOf);
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;
    return IERC721Receiver.onERC721Received.selector;
  }

  /**
   * @dev transfer ETH to an address, revert if it fails.
   * @param to recipient of the transfer
   * @param value the amount to send
   */
  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, "ETH_TRANSFER_FAILED");
  }

  /**
   * @dev transfer ERC20 from the utility contract, for ERC20 recovery in case of stuck tokens due
   * direct transfers to the contract address.
   * @param token token to transfer
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyTokenTransfer(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    IERC20(token).transfer(to, amount);
  }

  /**
   * @dev transfer native Ether from the utility contract, for native Ether recovery in case of stuck Ether
   * due selfdestructs or transfer ether to pre-computated contract address before deployment.
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyEtherTransfer(address to, uint256 amount) external onlyOwner {
    _safeTransferETH(to, amount);
  }

  /**
   * @dev Get WETH address used by WETHGateway
   */
  function getWETHAddress() external view returns (address) {
    return address(WETH);
  }

  /**
   * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }

  /**
   * @dev Revert fallback calls
   */
  fallback() external payable {
    revert("Fallback not allowed");
  }
}

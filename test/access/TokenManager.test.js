// const { BigNumber } = require("@ethersproject/bignumber")
const { expect } = require("chai")
const { ethers } = require("hardhat")

const TokenManagerError = {
  "AlreadyInitialized": "TokenManager: already initialized",
  "Forbidden": "TokenManager: forbidden",
  "ActionNotSignalled": "TokenManager: action not signalled",
  "ActionNotAuthorized": "TokenManager: action not authorized",
  "InsufficientAuthorization": "TokenManager: insufficient authorization",
  "AlreadySigned": "TokenManager: already signed"
}

const ERC20Error = {
  "TransferExceedsAllowance": "ERC20: transfer amount exceeds allowance",
  "TransferExceedsBalance": "ERC20: transfer amount exceeds balance"
}

const ERC721Error = {
  "NotApproved": "ERC721: caller is not token owner or approved"
}

const GMXTimelockError = {
  "Forbidden": "GmxTimelock: forbidden",
  "ActionNotSignalled": "GmxTimelock: action not signalled",
  "TimeNotPassed": "GmxTimelock: action time not yet passed"
}

describe("TokenManager.sol", function() {
  beforeEach(async function () {
    [
      this.wallet, this.user0, this.user1, this.user2, 
      this.signer0, this.signer1, this.signer2, this.accounts
    ] = await ethers.getSigners()

    const GMX = await ethers.getContractFactory("GMX")
    this.gmx = await GMX.deploy()

    const ETH = await ethers.getContractFactory("Token")
    this.eth = await ETH.deploy()

    const TokenManager = await ethers.getContractFactory("TokenManager")
    this.tokenManager = await TokenManager.deploy(2)

    await this.tokenManager.initialize([
      this.signer0.address,
      this.signer1.address,
      this.signer2.address
    ])

    const NFT0 = await ethers.getContractFactory("NFT")
    this.nft0 = await NFT0.deploy("NFT0", "NFT0")

    const NFT1 = await ethers.getContractFactory("NFT")
    this.nft1 = await NFT1.deploy("NFT1", "NFT1")

    this.nftId = 17

    const Timelock = await ethers.getContractFactory("Timelock")
    this.timelock = await Timelock.deploy(
      this.wallet.address, // admin
      5 * 24 * 60 * 60, // buffer
      this.tokenManager.address, // tokenManager
      this.user2.address, // mintReceiver
      this.user0.address, // glpManager
      this.user1.address, // rewardRouter
      ethers.utils.parseEther("1000"), // maxTokenSupply
      10, // marginFeeBasisPoints
      100 // maxMarginFeeBasisPoints
    )

    const GmxTimelock = await ethers.getContractFactory("GmxTimelock")
    this.gmxTimelock = await GmxTimelock.deploy(
      this.wallet.address,
      5 * 24 * 60 * 60,
      7 * 24 * 60 * 60,
      this.user0.address,
      this.tokenManager.address,
      this.user2.address,
      ethers.utils.parseEther("1000")
    )
  })

  it("inits", async function() {
    await expect(this.tokenManager.initialize([
      this.signer0.address,
      this.signer1.address,
      this.signer2.address
    ])).to.be.revertedWith(TokenManagerError.AlreadyInitialized)

    const listSigners = [
      this.signer0.address,
      this.signer1.address,
      this.signer2.address
    ]

    for (let i = 0; i < 3; i++) {
      expect(await this.tokenManager.signers(i)).eq(listSigners[i])
      expect(await this.tokenManager.isSigner(listSigners[i])).eq(true)
    }

    expect(await this.tokenManager.signersLength()).eq(3)
    expect(await this.tokenManager.isSigner(this.user0.address)).eq(false)
  })

  it("signalApprove", async function() {
    await expect(this.tokenManager.connect(this.user0).signalApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5")
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.wallet).signalApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5")
    )
  })

  it("signApprove", async function() {
    await expect(this.tokenManager.connect(this.user0).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer2).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5")
    )

    await expect(this.tokenManager.connect(this.user0).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.signer2).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )

    await expect(this.tokenManager.connect(this.signer2).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.AlreadySigned)

    await this.tokenManager.connect(this.signer1).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )
  })

  it("approve", async function() {
    await this.eth.mint(this.tokenManager.address, ethers.utils.parseEther("5"))

    await expect(this.tokenManager.connect(this.user0).approve(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.wallet).approve(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5")
    )

    await expect(this.tokenManager.connect(this.wallet).approve(
      this.gmx.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approve(
      this.eth.address,
      this.user0.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approve(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("6"),
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approve(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotAuthorized)

    await this.tokenManager.connect(this.signer0).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )

    await expect(this.tokenManager.connect(this.wallet).approve(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )).to.be.revertedWith(TokenManagerError.InsufficientAuthorization)

    await this.tokenManager.connect(this.signer2).signApprove(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )

    await expect(this.eth.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      ethers.utils.parseEther("4")
    )).to.be.revertedWith(ERC20Error.TransferExceedsAllowance)

    await this.tokenManager.connect(this.wallet).approve(
      this.eth.address,
      this.user2.address,
      ethers.utils.parseEther("5"),
      1
    )

    await expect(this.eth.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      ethers.utils.parseEther("6")
    )).to.be.revertedWith(ERC20Error.TransferExceedsBalance)

    expect(await this.eth.balanceOf(this.user1.address)).eq(0)

    await this.eth.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      ethers.utils.parseEther("5")
    )

    expect(await this.eth.balanceOf(this.user1.address)).eq(ethers.utils.parseEther("5"))
  })

  it("signalApproveNFT", async function() {
    await expect(this.tokenManager.connect(this.user0).signalApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.wallet).signalApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId
    )
  })

  it("signApproveNFT", async function() {
    await expect(this.tokenManager.connect(this.user0).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer2).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId,
      1
    ))

    await this.tokenManager.connect(this.wallet).signalApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId
    )

    await expect(this.tokenManager.connect(this.user0).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId
    ))

    await expect(this.tokenManager.connect(this.user0).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.signer2).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId,
      1
    )

    await expect(this.tokenManager.connect(this.signer2).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId,
      1
    ))

    await this.tokenManager.connect(this.signer1).signApproveNFT(
      this.eth.address,
      this.user2.address,
      this.nftId,
      1
    )
  })

  it("approveNFT", async function() {
    await this.nft0.mint(this.tokenManager.address, this.nftId)
    await this.nft1.mint(this.tokenManager.address, this.nftId)

    await expect(this.tokenManager.connect(this.user0).approveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.wallet).approveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalApproveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId
    )

    await expect(this.tokenManager.connect(this.wallet).approveNFT(
      this.nft1.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approveNFT(
      this.nft0.address,
      this.user0.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId + 1,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotAuthorized)

    await this.tokenManager.connect(this.signer0).signApproveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )

    await expect(this.tokenManager.connect(this.wallet).approveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )).to.be.revertedWith(TokenManagerError.InsufficientAuthorization)

    await this.tokenManager.connect(this.signer2).signApproveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )

    await expect(this.nft0.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      this.nftId
    )).to.be.revertedWith(ERC721Error.NotApproved)

    await this.tokenManager.connect(this.wallet).approveNFT(
      this.nft0.address,
      this.user2.address,
      this.nftId,
      1
    )

    expect(await this.nft0.balanceOf(this.user1.address)).eq(0)
    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(1)
    expect(await this.nft0.ownerOf(this.nftId)).eq(this.tokenManager.address)

    await this.nft0.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      this.nftId
    )

    expect(await this.nft0.balanceOf(this.user1.address)).eq(1)
    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(0)
    expect(await this.nft0.ownerOf(this.nftId)).eq(this.user1.address)

    await expect(this.nft0.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      this.nftId
    )).to.be.revertedWith(ERC721Error.NotApproved)
  })

  it("signalApproveNFTs", async function() {
    const nftIds = [21, 22]

    await expect(this.tokenManager.connect(this.user0).signalApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer2).signalApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds
    ))
  })

  it("signApproveNFTs", async function() {
    const nftIds = [21, 22]

    await expect(this.tokenManager.connect(this.user0).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer2).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds
    )

    await expect(this.tokenManager.connect(this.user0).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.signer2).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )

    await expect(this.tokenManager.connect(this.signer2).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.AlreadySigned)

    await this.tokenManager.connect(this.signer1).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )
  })

  it("approveNFTs", async function() {
    const nftIds = [21, 22]

    for (let i = 0; i < 2; i++) {
      await this.nft0.mint(this.tokenManager.address, nftIds[i])
    }

    await expect(this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds
    )

    await expect(this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft1.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      this.user0.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      this.user2.address,
      [nftIds[0], nftIds[1] + 1],
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.ActionNotAuthorized)

    await this.tokenManager.connect(this.signer0).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )

    await expect(this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )).to.be.revertedWith(TokenManagerError.InsufficientAuthorization)

    await this.tokenManager.connect(this.signer2).signApproveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )

    await expect(this.nft0.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      nftIds[0]
    )).to.be.revertedWith(ERC721Error.NotApproved)

    await this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      this.user2.address,
      nftIds,
      1
    )

    expect(await this.nft0.balanceOf(this.user1.address)).eq(0)
    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(2)

    for (let i = 0; i < 2; i++) {
      expect(await this.nft0.ownerOf(nftIds[i])).eq(this.tokenManager.address)
    }

    await this.nft0.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      nftIds[0]
    )

    expect(await this.nft0.balanceOf(this.user1.address)).eq(1)
    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(1)
    expect(await this.nft0.ownerOf(nftIds[0])).eq(this.user1.address)
    expect(await this.nft0.ownerOf(nftIds[1])).eq(this.tokenManager.address)

    await this.nft0.connect(this.user2).transferFrom(
      this.tokenManager.address,
      this.user1.address,
      nftIds[1]
    )

    expect(await this.nft0.balanceOf(this.user1.address)).eq(2)
    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(0)

    for (let i = 0; i < 2; i++) {
      expect(await this.nft0.ownerOf(nftIds[i])).eq(this.user1.address)
    }
  })

  it("receiveNFTs", async function() {
    const nftIds = [21, 22]

    for (let i = 0; i < 2; i++) {
      await this.nft0.mint(this.tokenManager.address, nftIds[i])
    }

    const TokenManager2 = await ethers.getContractFactory("TokenManager")
    const tokenManager2 = await TokenManager2.deploy(2)

    await this.tokenManager.connect(this.wallet).signalApproveNFTs(
      this.nft0.address,
      tokenManager2.address,
      nftIds
    )

    await this.tokenManager.connect(this.signer0).signApproveNFTs(
      this.nft0.address,
      tokenManager2.address,
      nftIds,
      1
    )

    await this.tokenManager.connect(this.signer2).signApproveNFTs(
      this.nft0.address,
      tokenManager2.address,
      nftIds,
      1
    )

    await expect(tokenManager2.receiveNFTs(
      this.nft0.address,
      this.tokenManager.address,
      nftIds
    )).to.be.revertedWith(ERC721Error.NotApproved)

    await this.tokenManager.connect(this.wallet).approveNFTs(
      this.nft0.address,
      tokenManager2.address,
      nftIds,
      1
    )

    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(2)
    expect(await this.nft0.balanceOf(tokenManager2.address)).eq(0)
    
    for (let i = 0; i < 2; i++) {
      expect(await this.nft0.ownerOf(nftIds[i])).eq(this.tokenManager.address)
    }

    await tokenManager2.receiveNFTs(this.nft0.address, this.tokenManager.address, nftIds)

    expect(await this.nft0.balanceOf(this.tokenManager.address)).eq(0)
    expect(await this.nft0.balanceOf(tokenManager2.address)).eq(2)
    
    for (let i = 0; i < 2; i++) {
      expect(await this.nft0.ownerOf(nftIds[i])).eq(tokenManager2.address)
    }
  })

  it("signalSetAdmin", async function() {
    await expect(this.tokenManager.connect(this.user0).signalSetAdmin(
      this.timelock.address, this.user1.address
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.wallet).signalSetAdmin(
      this.timelock.address, this.user1.address
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.signer0).signalSetAdmin(
      this.timelock.address, this.user1.address
    )
  })

  it("signSetAdmin", async function() {
    await expect(this.tokenManager.connect(this.user0).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.wallet).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer1).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.signer1).signalSetAdmin(
      this.timelock.address, this.user1.address
    )

    await expect(this.tokenManager.connect(this.user0).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer1).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.AlreadySigned)

    await this.tokenManager.connect(this.signer2).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )

    await expect(this.tokenManager.connect(this.signer2).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.AlreadySigned)
  })

  it("setAdmin", async function() {
    await expect(this.tokenManager.connect(this.user0).setAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.wallet).setAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer0).setAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.signer0).signalSetAdmin(
      this.timelock.address, this.user1.address
    )

    await expect(this.tokenManager.connect(this.signer0).setAdmin(
      this.user0.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.signer0).setAdmin(
      this.timelock.address, this.user1.address, 2
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.signer0).setAdmin(
      this.timelock.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.InsufficientAuthorization)

    await this.tokenManager.connect(this.signer2).signSetAdmin(
      this.timelock.address, this.user1.address, 1
    )

    expect(await this.timelock.admin()).eq(this.wallet.address)
    await this.tokenManager.connect(this.signer2).setAdmin(this.timelock.address, this.user1.address, 1)
    expect(await this.timelock.admin()).eq(this.user1.address)
  })

  it("signalSetGov", async function() {
    await expect(this.tokenManager.connect(this.user0).signalSetGov(
      this.timelock.address, this.gmx.address, this.user1.address
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.wallet).signalSetGov(
      this.timelock.address, this.gmx.address, this.user1.address
    )
  })

  it("signSetGov", async function() {
    await expect(this.tokenManager.connect(this.user0).signSetGov(
      this.timelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.signer2).signSetGov(
      this.timelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalSetGov(
      this.timelock.address, this.gmx.address, this.user1.address
    )

    await expect(this.tokenManager.connect(this.user0).signSetGov(
      this.timelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await this.tokenManager.connect(this.signer2).signSetGov(
      this.timelock.address, this.gmx.address, this.user1.address, 1
    )

    await expect(this.tokenManager.connect(this.signer2).signSetGov(
      this.timelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.AlreadySigned)

    await this.tokenManager.connect(this.signer1).signSetGov(
      this.timelock.address, this.gmx.address, this.user1.address, 1
    )
  })

  it("setGov", async function() {
    await this.gmx.setGov(this.gmxTimelock.address)

    await expect(this.tokenManager.connect(this.user0).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.Forbidden)

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).signalSetGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address
    )

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.user2.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.user0.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user2.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 2
    )).to.be.revertedWith(TokenManagerError.ActionNotSignalled)

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.ActionNotAuthorized)

    await this.tokenManager.connect(this.signer0).signSetGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )

    await expect(this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )).to.be.revertedWith(TokenManagerError.InsufficientAuthorization)

    await expect(this.gmxTimelock.connect(this.wallet).signalSetGov(
      this.gmx.address, this.user1.address
    )).to.be.revertedWith(GMXTimelockError.Forbidden)

    await this.tokenManager.connect(this.signer2).signSetGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )

    await expect(this.gmxTimelock.connect(this.wallet).setGov(
      this.gmx.address, this.user1.address
    )).to.be.revertedWith(GMXTimelockError.ActionNotSignalled)

    await this.tokenManager.connect(this.wallet).setGov(
      this.gmxTimelock.address, this.gmx.address, this.user1.address, 1
    )

    await expect(this.gmxTimelock.connect(this.wallet).setGov(
      this.gmx.address, this.user1.address
    )).to.be.revertedWith(GMXTimelockError.TimeNotPassed)

    await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60 + 10])
    await ethers.provider.send("evm_mine", []);

    await expect(this.gmxTimelock.connect(this.wallet).setGov(
      this.gmx.address, this.user1.address
    )).to.be.revertedWith(GMXTimelockError.TimeNotPassed)

    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60 * 10])
    await ethers.provider.send("evm_mine", [])

    expect(await this.gmx.gov()).eq(this.gmxTimelock.address)

    await this.gmxTimelock.connect(this.wallet).setGov(
      this.gmx.address, this.user1.address
    )

    expect(await this.gmx.gov()).eq(this.user1.address)
  })
})

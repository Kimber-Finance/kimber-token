import { waffleChai } from '@ethereum-waffle/chai';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { expect, use } from 'chai';
import hre, { ethers } from 'hardhat';
import { DelegationType, Fixture } from '../types';
import { deployMockDoubleTransfer } from '../utils/contractDeployer';
import { advanceTimeAndBlock, waitForTx } from '../utils/hhNetwork';
import setupFixture from '../utils/setupFixture';

const {Zero, MaxUint256, AddressZero} = ethers.constants;
const {utils} = ethers;

use(waffleChai);

describe('Delegation', () => {
  let firstActionBlockNumber = 0;
  let secondActionBlockNumber = 0;

  const fixture = {} as Fixture;
  let domain: TypedDataDomain;
  const delegateTypes = {
    Delegate: [
      {name: 'delegatee', type: 'address'},
      {name: 'nonce', type: 'uint256'},
      {name: 'expiry', type: 'uint256'},
    ],
  };
  const delegateByTypeTypes = {
    DelegateByType: [
      {name: 'delegatee', type: 'address'},
      {name: 'type', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'expiry', type: 'uint256'},
    ],
  };

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {chainId, kimberToken} = fixture;
    domain = {
      name: 'Kimber Token',
      version: '1',
      chainId: chainId,
      verifyingContract: kimberToken.address,
    };
  });

  // Blocked by https://github.com/nomiclabs/hardhat/issues/1081
  xit('AddressZero tries to delegate voting power to user1 but delegatee should still be AddressZero', async () => {
    const {kimberToken, user1} = fixture;

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [AddressZero],
    });
    const zeroUser = await ethers.provider.getSigner(AddressZero);
    await user1.signer.sendTransaction({to: AddressZero, value: utils.parseEther('1')});

    console.log(await (await zeroUser.getBalance()).toWadUnit());
    console.log('user1 address', user1.address);

    await kimberToken.connect(zeroUser).delegateByType(user1.address, DelegationType.VOTING_POWER);

    // await expect(Promise.resolve(tx))
    //   .to.emit(kimberToken, 'DelegatedPowerChanged')
    //   .withArgs(AddressZero, user1.address, DelegationType.VOTING_POWER);

    const delegatee = await kimberToken.getDelegateeByType(AddressZero, DelegationType.VOTING_POWER);

    expect(delegatee).to.be.equal(AddressZero);
  });

  it('user1 tries to delegate voting power to user2', async () => {
    const {kimberToken, user1, user2} = fixture;

    await user1.kimberToken.delegateByType(user2.address, DelegationType.VOTING_POWER);

    const delegatee = await kimberToken.getDelegateeByType(user1.address, DelegationType.VOTING_POWER);

    expect(delegatee).to.be.equal(user2.address);
  });

  it('user1 tries to delegate proposition power to user3', async () => {
    const {kimberToken, user1, user3} = fixture;

    await user1.kimberToken.delegateByType(user3.address, DelegationType.PROPOSITION_POWER);

    const delegatee = await kimberToken.getDelegateeByType(user1.address, DelegationType.PROPOSITION_POWER);

    expect(delegatee).to.be.equal(user3.address);
  });

  it('Revert: User1 tries to delegate voting power to AddressZero', async () => {
    const {user1} = fixture;

    await expect(user1.kimberToken.delegateByType(AddressZero, DelegationType.VOTING_POWER)).to.be.revertedWith(
      'INVALID_DELEGATEE'
    );
    await expect(user1.kimberToken.delegateByType(AddressZero, DelegationType.PROPOSITION_POWER)).to.be.revertedWith(
      'INVALID_DELEGATEE'
    );
  });

  it('user1 obtains 1 KIMBER; checks voting and proposition power of user2 and 3', async () => {
    const {kimberToken, distributer, user1, user2, user3} = fixture;
    const amount = utils.parseEther('1');

    const tx = await waitForTx(await distributer.kimberToken.transfer(user1.address, amount));
    firstActionBlockNumber = tx.blockNumber;

    const user1PropPower = await kimberToken.getPowerCurrent(user1.address, DelegationType.VOTING_POWER);
    const user1VotingPower = await kimberToken.getPowerCurrent(user1.address, DelegationType.PROPOSITION_POWER);

    const user2VotingPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.VOTING_POWER);
    const user2PropPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.PROPOSITION_POWER);

    const user3VotingPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.VOTING_POWER);
    const user3PropPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.PROPOSITION_POWER);

    expect(user1PropPower).to.be.equal(Zero, 'Invalid prop power for user1');
    expect(user1VotingPower).to.be.equal(Zero, 'Invalid voting power for user1');

    expect(user2PropPower).to.be.equal(Zero, 'Invalid prop power for user2');
    expect(user2VotingPower).to.be.equal(amount, 'Invalid voting power for user2');

    expect(user3PropPower).to.be.equal(amount, 'Invalid prop power for user3');
    expect(user3VotingPower).to.be.equal(Zero, 'Invalid voting power for user3');

    expect(await kimberToken.balanceOf(user1.address)).to.be.equal(amount);
  });

  it('user2 obtains 1 KIMBER; checks voting and proposition power of user2', async () => {
    const {kimberToken, distributer, user2} = fixture;
    const amount = utils.parseEther('1');

    await waitForTx(await distributer.kimberToken.transfer(user2.address, amount));

    const user2VotingPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.VOTING_POWER);
    const user2PropPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.PROPOSITION_POWER);

    expect(user2PropPower).to.be.equal(amount, 'Invalid prop power for user2');
    expect(user2VotingPower).to.be.equal(amount.mul('2'), 'Invalid voting power for user2');
  });

  it('user3 obtains 1 KIMBER; checks voting and proposition power of user3', async () => {
    const {kimberToken, distributer, user3} = fixture;
    const amount = utils.parseEther('1');

    await waitForTx(await distributer.kimberToken.transfer(user3.address, amount));

    const user3VotingPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.VOTING_POWER);
    const user3PropPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.PROPOSITION_POWER);

    expect(user3PropPower).to.be.equal(amount.mul('2'), 'Invalid prop power for user3');
    expect(user3VotingPower).to.be.equal(amount, 'Invalid voting power for user3');
  });

  it('user2 delegates voting and prop power to user3', async () => {
    const {kimberToken, user2, user3} = fixture;

    const expectedDelegatedVotingPower = utils.parseEther('2');
    const expectedDelegatedPropPower = utils.parseEther('3');

    await waitForTx(await user2.kimberToken.delegate(user3.address));

    const user3VotingPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.VOTING_POWER);
    const user3PropPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.PROPOSITION_POWER);

    expect(user3VotingPower).to.be.equal(expectedDelegatedVotingPower, 'Invalid voting power for user3');
    expect(user3PropPower).to.be.equal(expectedDelegatedPropPower, 'Invalid prop power for user3');
  });

  it('user1 removes voting and prop power to user2 and 3', async () => {
    const {kimberToken, user1, user2, user3} = fixture;

    await waitForTx(await user1.kimberToken.delegate(user1.address));

    const user2VotingPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.VOTING_POWER);
    const user2PropPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.PROPOSITION_POWER);

    const user3VotingPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.VOTING_POWER);
    const user3PropPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.PROPOSITION_POWER);

    const expectedUser2DelegatedVotingPower = Zero;
    const expectedUser2DelegatedPropPower = Zero;

    const expectedUser3DelegatedVotingPower = utils.parseEther('2');
    const expectedUser3DelegatedPropPower = utils.parseEther('2');

    expect(user2VotingPower).to.be.equal(expectedUser2DelegatedVotingPower, 'Invalid voting power for user3');
    expect(user2PropPower).to.be.equal(expectedUser2DelegatedPropPower, 'Invalid prop power for user3');

    expect(user3VotingPower).to.be.equal(expectedUser3DelegatedVotingPower, 'Invalid voting power for user3');
    expect(user3PropPower).to.be.equal(expectedUser3DelegatedPropPower, 'Invalid prop power for user3');
  });

  it('checks the delegation at the block of the first action', async () => {
    const {kimberToken, user1, user2, user3} = fixture;

    const user1VotingPower = await kimberToken.getPowerAtBlock(
      user1.address,
      firstActionBlockNumber,
      DelegationType.VOTING_POWER
    );
    const user1PropPower = await kimberToken.getPowerAtBlock(
      user1.address,
      firstActionBlockNumber,
      DelegationType.PROPOSITION_POWER
    );

    const user2VotingPower = await kimberToken.getPowerAtBlock(
      user2.address,
      firstActionBlockNumber,
      DelegationType.VOTING_POWER
    );
    const user2PropPower = await kimberToken.getPowerAtBlock(
      user2.address,
      firstActionBlockNumber,
      DelegationType.PROPOSITION_POWER
    );

    const user3VotingPower = await kimberToken.getPowerAtBlock(
      user3.address,
      firstActionBlockNumber,
      DelegationType.VOTING_POWER
    );
    const user3PropPower = await kimberToken.getPowerAtBlock(
      user3.address,
      firstActionBlockNumber,
      DelegationType.PROPOSITION_POWER
    );

    const expectedUser1DelegatedVotingPower = Zero;
    const expectedUser1DelegatedPropPower = Zero;

    const expectedUser2DelegatedVotingPower = utils.parseEther('1');
    const expectedUser2DelegatedPropPower = Zero;

    const expectedUser3DelegatedVotingPower = Zero;
    const expectedUser3DelegatedPropPower = utils.parseEther('1');

    expect(user1VotingPower).to.be.equal(expectedUser1DelegatedPropPower, 'Invalid voting power for user1');
    expect(user1PropPower).to.be.equal(expectedUser1DelegatedVotingPower, 'Invalid prop power for user1');

    expect(user2VotingPower).to.be.equal(expectedUser2DelegatedVotingPower, 'Invalid voting power for user2');
    expect(user2PropPower).to.be.equal(expectedUser2DelegatedPropPower, 'Invalid prop power for user2');

    expect(user3VotingPower).to.be.equal(expectedUser3DelegatedVotingPower, 'Invalid voting power for user3');
    expect(user3PropPower).to.be.equal(expectedUser3DelegatedPropPower, 'Invalid prop power for user3');
  });

  it('ensure that getting the power at the current block is the same as using getPowerCurrent', async () => {
    const {kimberToken, user1} = fixture;

    await advanceTimeAndBlock(1);

    const currentBlock = await ethers.provider.getBlockNumber();

    const votingPowerAtPreviousBlock = await kimberToken.getPowerAtBlock(
      user1.address,
      currentBlock - 1,
      DelegationType.VOTING_POWER
    );
    const votingPowerCurrent = await kimberToken.getPowerCurrent(user1.address, DelegationType.VOTING_POWER);

    const propPowerAtPreviousBlock = await kimberToken.getPowerAtBlock(
      user1.address,
      currentBlock - 1,
      DelegationType.PROPOSITION_POWER
    );
    const propPowerCurrent = await kimberToken.getPowerCurrent(user1.address, DelegationType.PROPOSITION_POWER);

    expect(votingPowerAtPreviousBlock.toString()).to.be.equal(
      votingPowerCurrent.toString(),
      'Invalid voting power for user1'
    );
    expect(propPowerAtPreviousBlock.toString()).to.be.equal(
      propPowerCurrent.toString(),
      'Invalid voting power for user1'
    );
  });

  it("checks you can't fetch power at a block in the future", async () => {
    const {kimberToken, user1} = fixture;

    const currentBlock = await ethers.provider.getBlockNumber();

    await expect(
      kimberToken.getPowerAtBlock(user1.address, currentBlock + 1, DelegationType.VOTING_POWER)
    ).to.be.revertedWith('INVALID_BLOCK_NUMBER');
    await expect(
      kimberToken.getPowerAtBlock(user1.address, currentBlock + 1, DelegationType.PROPOSITION_POWER)
    ).to.be.revertedWith('INVALID_BLOCK_NUMBER');
  });

  it('user1 transfers value to himself. Ensures nothing changes in the delegated power', async () => {
    const {kimberToken, user1} = fixture;

    const user1VotingPowerBefore = await kimberToken.getPowerCurrent(user1.address, DelegationType.VOTING_POWER);
    const user1PropPowerBefore = await kimberToken.getPowerCurrent(user1.address, DelegationType.PROPOSITION_POWER);

    const balance = await kimberToken.balanceOf(user1.address);

    await user1.kimberToken.transfer(user1.address, balance);

    const user1VotingPowerAfter = await kimberToken.getPowerCurrent(user1.address, DelegationType.VOTING_POWER);
    const user1PropPowerAfter = await kimberToken.getPowerCurrent(user1.address, DelegationType.PROPOSITION_POWER);

    expect(user1VotingPowerBefore.toString()).to.be.equal(user1VotingPowerAfter, 'Invalid voting power for user1');
    expect(user1PropPowerBefore.toString()).to.be.equal(user1PropPowerAfter, 'Invalid prop power for user1');
  });

  it('user1 delegates voting power to user2 via signature', async () => {
    const {kimberToken, user1, user2} = fixture;

    // Calculate expected voting power
    const user2VotPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.PROPOSITION_POWER);
    const expectedVotingPower = (await kimberToken.getPowerCurrent(user1.address, DelegationType.PROPOSITION_POWER)).add(
      user2VotPower
    );

    // Check prior delegatee is still user1
    const priorDelegatee = await kimberToken.getDelegateeByType(user1.address, DelegationType.VOTING_POWER);
    expect(priorDelegatee).to.be.equal(user1.address);

    const nonce = await kimberToken._nonces(user1.address);
    const expiration = MaxUint256;

    const value = {
      delegatee: user2.address,
      type: DelegationType.VOTING_POWER,
      nonce,
      expiry: expiration,
    };
    const sig = await user1.signer._signTypedData(domain, delegateByTypeTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    // Transmit message via delegateByTypeBySig
    const tx = await user1.kimberToken.delegateByTypeBySig(
      user2.address,
      DelegationType.VOTING_POWER,
      nonce,
      expiration,
      v,
      r,
      s
    );

    // Check tx success and DelegateChanged
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegateChanged')
      .withArgs(user1.address, user2.address, DelegationType.VOTING_POWER);

    // Check DelegatedPowerChanged event: user1 power should drop to zero
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user1.address, 0, DelegationType.VOTING_POWER);

    // Check DelegatedPowerChanged event: users[2] power should increase to expectedVotingPower
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user2.address, expectedVotingPower, DelegationType.VOTING_POWER);

    // Check internal state
    const delegatee = await kimberToken.getDelegateeByType(user1.address, DelegationType.VOTING_POWER);
    expect(delegatee.toString()).to.be.equal(user2.address, 'Delegatee should be user2');

    const user2VotingPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.VOTING_POWER);
    expect(user2VotingPower).to.be.equal(expectedVotingPower, 'Delegatee should have voting power from user1');
  });

  it('user1 delegates proposition to user3 via signature', async () => {
    const {kimberToken, user1, user3} = fixture;

    // Calculate expected proposition power
    const user3PropPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.PROPOSITION_POWER);
    const expectedPropPower = (await kimberToken.getPowerCurrent(user1.address, DelegationType.PROPOSITION_POWER)).add(
      user3PropPower
    );

    // Check prior proposition delegatee is still user1
    const priorDelegatee = await kimberToken.getDelegateeByType(user1.address, DelegationType.PROPOSITION_POWER);
    expect(priorDelegatee.toString()).to.be.equal(user1.address, 'expected proposition delegatee to be user1');

    const nonce = await kimberToken._nonces(user1.address);
    const expiration = MaxUint256;

    const value = {
      delegatee: user3.address,
      type: DelegationType.PROPOSITION_POWER,
      nonce,
      expiry: expiration,
    };
    const sig = await user1.signer._signTypedData(domain, delegateByTypeTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    // Transmit tx via delegateByTypeBySig
    const tx = await user1.kimberToken.delegateByTypeBySig(
      user3.address,
      DelegationType.PROPOSITION_POWER,
      nonce,
      expiration,
      v,
      r,
      s
    );

    // Check tx success and DelegateChanged
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegateChanged')
      .withArgs(user1.address, user3.address, DelegationType.PROPOSITION_POWER);

    // Check DelegatedPowerChanged event: user1 power should drop to zero
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user1.address, 0, DelegationType.PROPOSITION_POWER);

    // Check DelegatedPowerChanged event: users[2] power should increase to expectedVotingPower
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user3.address, expectedPropPower, 1);

    // Check internal state matches events
    const delegatee = await kimberToken.getDelegateeByType(user1.address, DelegationType.PROPOSITION_POWER);
    expect(delegatee.toString()).to.be.equal(user3.address, 'Delegatee should be user3');

    const user3PropositionPower = await kimberToken.getPowerCurrent(user3.address, DelegationType.PROPOSITION_POWER);
    expect(user3PropositionPower).to.be.equal(expectedPropPower, 'Delegatee should have propostion power from user1');

    // Save current block
    secondActionBlockNumber = await ethers.provider.getBlockNumber();
  });

  it('user2 delegates all to User 4 via signature', async () => {
    const {kimberToken, user1, user2, user4} = fixture;

    await user2.kimberToken.delegate(user2.address);

    // Calculate expected powers
    const user4PropPower = await kimberToken.getPowerCurrent(user4.address, DelegationType.PROPOSITION_POWER);
    const expectedPropPower = (await kimberToken.getPowerCurrent(user2.address, DelegationType.PROPOSITION_POWER)).add(
      user4PropPower
    );

    const user1VotingPower = await kimberToken.balanceOf(user1.address);
    const user4VotPower = await kimberToken.getPowerCurrent(user4.address, DelegationType.VOTING_POWER);
    const user2ExpectedVotPower = user1VotingPower;
    const user4ExpectedVotPower = (await kimberToken.getPowerCurrent(user2.address, DelegationType.VOTING_POWER))
      .add(user4VotPower)
      .sub(user1VotingPower); // Delegation does not delegate votes others from other delegations

    // Check prior proposition delegatee is still user1
    const priorPropDelegatee = await kimberToken.getDelegateeByType(user2.address, DelegationType.PROPOSITION_POWER);
    expect(priorPropDelegatee.toString()).to.be.equal(user2.address, 'expected proposition delegatee to be user1');

    const priorVotDelegatee = await kimberToken.getDelegateeByType(user2.address, DelegationType.VOTING_POWER);
    expect(priorVotDelegatee.toString()).to.be.equal(user2.address, 'expected proposition delegatee to be user1');

    const nonce = await kimberToken._nonces(user2.address);
    const expiration = MaxUint256;

    const value = {
      delegatee: user4.address,
      nonce,
      expiry: expiration,
    };
    const sig = await user2.signer._signTypedData(domain, delegateTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    // Transmit tx via delegateByTypeBySig
    const tx = await user2.kimberToken.delegateBySig(user4.address, nonce, expiration, v, r, s);

    // Check tx success and DelegateChanged for voting
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegateChanged')
      .withArgs(user2.address, user4.address, DelegationType.PROPOSITION_POWER);
    // Check tx success and DelegateChanged for proposition
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegateChanged')
      .withArgs(user2.address, user4.address, DelegationType.VOTING_POWER);

    // Check DelegatedPowerChanged event: users[2] power should drop to zero
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user2.address, 0, DelegationType.PROPOSITION_POWER);

    // Check DelegatedPowerChanged event: users[4] power should increase to expectedVotingPower
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user4.address, expectedPropPower, DelegationType.PROPOSITION_POWER);

    // Check DelegatedPowerChanged event: users[2] power should drop to zero
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user2.address, user2ExpectedVotPower, DelegationType.VOTING_POWER);

    // Check DelegatedPowerChanged event: users[4] power should increase to expectedVotingPower
    await expect(Promise.resolve(tx))
      .to.emit(kimberToken, 'DelegatedPowerChanged')
      .withArgs(user4.address, user4ExpectedVotPower, DelegationType.VOTING_POWER);

    // Check internal state matches events
    const propDelegatee = await kimberToken.getDelegateeByType(user2.address, DelegationType.PROPOSITION_POWER);
    expect(propDelegatee.toString()).to.be.equal(user4.address, 'Proposition delegatee should be user 4');

    const votDelegatee = await kimberToken.getDelegateeByType(user2.address, DelegationType.VOTING_POWER);
    expect(votDelegatee.toString()).to.be.equal(user4.address, 'Voting delegatee should be user 4');

    const user4PropositionPower = await kimberToken.getPowerCurrent(user4.address, DelegationType.PROPOSITION_POWER);
    expect(user4PropositionPower).to.be.equal(expectedPropPower, 'Delegatee should have propostion power from user2');
    const user4VotingPower = await kimberToken.getPowerCurrent(user4.address, DelegationType.VOTING_POWER);
    expect(user4VotingPower).to.be.equal(user4ExpectedVotPower, 'Delegatee should have votinh power from user2');

    const user2PropositionPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.PROPOSITION_POWER);
    expect(user2PropositionPower).to.be.equal(Zero, 'user2 should have zero prop power');
    const user2VotingPower = await kimberToken.getPowerCurrent(user2.address, DelegationType.VOTING_POWER);
    expect(user2VotingPower).to.be.equal(
      user2ExpectedVotPower,
      'user2 should still have voting power from user1 delegation'
    );
  });

  it('user1 should not be able to delegate with bad signature', async () => {
    const {kimberToken, user1, user2} = fixture;
    const nonce = await kimberToken._nonces(user1.address);
    const expiration = MaxUint256;
    const value = {
      delegatee: user2.address,
      type: DelegationType.VOTING_POWER,
      nonce,
      expiry: expiration,
    };
    const sig = await user1.signer._signTypedData(domain, delegateByTypeTypes, value);
    const {r, s} = utils.splitSignature(sig);

    await expect(
      user1.kimberToken.delegateByTypeBySig(user2.address, DelegationType.VOTING_POWER, nonce, expiration, 0, r, s)
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('user1 should not be able to delegate with bad nonce', async () => {
    const {user1, user2} = fixture;
    const nonce = Zero;
    const expiration = MaxUint256;
    const value = {
      delegatee: user2.address,
      type: DelegationType.VOTING_POWER,
      nonce,
      expiry: expiration,
    };
    const sig = await user1.signer._signTypedData(domain, delegateByTypeTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    await expect(
      user1.kimberToken.delegateByTypeBySig(user2.address, DelegationType.VOTING_POWER, nonce, expiration, v, r, s)
    ).to.be.revertedWith('INVALID_NONCE');
  });

  it('user1 should not be able to delegate if signature expired', async () => {
    const {kimberToken, user1, user2} = fixture;
    const nonce = await kimberToken._nonces(user1.address);
    const expiration = Zero;
    const value = {
      delegatee: user2.address,
      type: DelegationType.VOTING_POWER,
      nonce,
      expiry: expiration,
    };
    const sig = await user1.signer._signTypedData(domain, delegateByTypeTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    await expect(
      user1.kimberToken.delegateByTypeBySig(user2.address, DelegationType.VOTING_POWER, nonce, expiration, v, r, s)
    ).to.be.revertedWith('INVALID_EXPIRATION');
  });

  it('user2 should not be able to delegate all with bad signature', async () => {
    const {kimberToken, user4, user2} = fixture;

    const nonce = (await kimberToken._nonces(user2.address)).toString();
    const expiration = MaxUint256;
    const value = {
      delegatee: user4.address,
      nonce,
      expiry: expiration,
    };
    const sig = await user2.signer._signTypedData(domain, delegateTypes, value);
    const {r, s} = utils.splitSignature(sig);

    await expect(user2.kimberToken.delegateBySig(user4.address, nonce, expiration, Zero, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('user2 should not be able to delegate all with bad nonce', async () => {
    const {user2, user4} = fixture;
    const nonce = Zero;
    const expiration = MaxUint256;
    const value = {
      delegatee: user4.address,
      nonce,
      expiry: expiration,
    };
    const sig = await user2.signer._signTypedData(domain, delegateTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    await expect(user2.kimberToken.delegateBySig(user4.address, nonce, expiration, v, r, s)).to.be.revertedWith(
      'INVALID_NONCE'
    );
  });

  it('user2 should not be able to delegate all if signature expired', async () => {
    const {kimberToken, user2, user4} = fixture;
    const nonce = await kimberToken._nonces(user2.address);
    const expiration = Zero;
    const value = {
      delegatee: user4.address,
      nonce,
      expiry: expiration,
    };
    const sig = await user2.signer._signTypedData(domain, delegateTypes, value);
    const {v, r, s} = utils.splitSignature(sig);

    await expect(user2.kimberToken.delegateBySig(user4.address, nonce, expiration, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
  });

  it('checks the delegation at the block of the second saved action', async () => {
    const {kimberToken, user1, user2, user3} = fixture;

    const user1VotingPower = await kimberToken.getPowerAtBlock(
      user1.address,
      secondActionBlockNumber,
      DelegationType.VOTING_POWER
    );
    const user1PropPower = await kimberToken.getPowerAtBlock(
      user1.address,
      secondActionBlockNumber,
      DelegationType.PROPOSITION_POWER
    );

    const user2VotingPower = await kimberToken.getPowerAtBlock(
      user2.address,
      secondActionBlockNumber,
      DelegationType.VOTING_POWER
    );
    const user2PropPower = await kimberToken.getPowerAtBlock(
      user2.address,
      secondActionBlockNumber,
      DelegationType.PROPOSITION_POWER
    );

    const user3VotingPower = await kimberToken.getPowerAtBlock(
      user3.address,
      secondActionBlockNumber,
      DelegationType.VOTING_POWER
    );
    const user3PropPower = await kimberToken.getPowerAtBlock(
      user3.address,
      secondActionBlockNumber,
      DelegationType.PROPOSITION_POWER
    );

    const expectedUser1DelegatedVotingPower = Zero;
    const expectedUser1DelegatedPropPower = Zero;

    const expectedUser2DelegatedVotingPower = utils.parseEther('1');
    const expectedUser2DelegatedPropPower = Zero;

    const expectedUser3DelegatedVotingPower = utils.parseEther('2');
    const expectedUser3DelegatedPropPower = utils.parseEther('3');

    expect(user1VotingPower.toString()).to.be.equal(expectedUser1DelegatedPropPower, 'Invalid voting power for user1');
    expect(user1PropPower.toString()).to.be.equal(expectedUser1DelegatedVotingPower, 'Invalid prop power for user1');

    expect(user2VotingPower.toString()).to.be.equal(
      expectedUser2DelegatedVotingPower,
      'Invalid voting power for user2'
    );
    expect(user2PropPower.toString()).to.be.equal(expectedUser2DelegatedPropPower, 'Invalid prop power for user2');

    expect(user3VotingPower.toString()).to.be.equal(
      expectedUser3DelegatedVotingPower,
      'Invalid voting power for user3'
    );
    expect(user3PropPower.toString()).to.be.equal(expectedUser3DelegatedPropPower, 'Invalid prop power for user3');
  });

  it('correct proposal and voting snapshotting on double action in the same block', async () => {
    const {kimberToken, user1, user5} = fixture;

    // Reset delegations
    await user1.kimberToken.delegate(user1.address);
    await user5.kimberToken.delegate(user5.address);

    const user1PriorBalance = await kimberToken.balanceOf(user1.address);
    const receiverPriorPower = await kimberToken.getPowerCurrent(user5.address, DelegationType.VOTING_POWER);
    const user1PriorPower = await kimberToken.getPowerCurrent(user1.address, DelegationType.VOTING_POWER);

    expect(user1PriorBalance).to.be.gt(Zero);

    // Deploy double transfer helper
    const mockDoubleTransfer = await deployMockDoubleTransfer(hre, kimberToken.address);

    await waitForTx(await user1.kimberToken.transfer(mockDoubleTransfer.address, user1PriorBalance));

    // Do double transfer
    await waitForTx(
      await mockDoubleTransfer
        .connect(user1.signer)
        .doubleSend(user5.address, user1PriorBalance.sub(utils.parseEther('1')), utils.parseEther('1'))
    );

    const receiverCurrentPower = await kimberToken.getPowerCurrent(user5.address, DelegationType.VOTING_POWER);
    const user1CurrentPower = await kimberToken.getPowerCurrent(user1.address, DelegationType.VOTING_POWER);

    expect(receiverCurrentPower).to.be.equal(
      user1PriorPower.add(receiverPriorPower),
      'Receiver should have added the user1 power after double transfer'
    );
    expect(user1CurrentPower).to.be.equal(Zero, 'User1 power should be zero due transfered all the funds');
  });
});

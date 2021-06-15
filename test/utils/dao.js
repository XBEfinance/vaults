const { hash } = require('eth-ens-namehash')
const Web3 = require("web3");

const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const { getEventArgument } = require('@aragon/contract-helpers-test/src/events.js')
const contract = require("@truffle/contract");
const dataKernel = require("@aragon/os/build/contracts/Kernel.json");
const dataACL = require('@aragon/os/build/contracts/ACL.json');
const dataEVMS = require('@aragon/os/build/contracts/EVMScriptRegistryFactory.json')
const dataFactory = require('@aragon/os/build/contracts/DAOFactory.json')
const dataRegister = require('@aragon/os/build/contracts/EVMScriptRegistry.json')


const Kernel = contract(dataKernel);
const ACL = contract(dataACL)
const EVMScriptRegistryFactory = contract(dataEVMS);
const DAOFactory = contract(dataFactory);
const EVMScriptRegistry = contract(dataRegister);
Kernel.setProvider(provider);
ACL.setProvider(provider);
EVMScriptRegistryFactory.setProvider(provider);
DAOFactory.setProvider(provider);
EVMScriptRegistry.setProvider(provider)

const APP_ID = '0x1234123412341234123412341234123412341234123412341234123412341234'
const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'


const newDao = async (rootAccount) => {
  // Deploy a DAOFactory.
  const kernelBase = await Kernel.new(true, {from: rootAccount})
  const aclBase = await ACL.new({from: rootAccount})
  const registryFactory = await EVMScriptRegistryFactory.new({from: rootAccount})
  const daoFactory = await DAOFactory.new(
    kernelBase.address,
    aclBase.address,
    registryFactory.address,
    {from: rootAccount}
  )
  // registryFactory.addScriptExecutor(rootAccount);
  // Create a DAO instance.
  const daoReceipt = await daoFactory.newDAO(rootAccount, {from: rootAccount})
  const dao = await Kernel.at(getEventArgument(daoReceipt, 'DeployDAO', 'dao'))

  // Grant the rootAccount address permission to install apps in the DAO.
  const acl = await ACL.at(await dao.acl())
  const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
  await acl.createPermission(
    rootAccount,
    dao.address,
    APP_MANAGER_ROLE,
    rootAccount,
    { from: rootAccount }
  )
  return { dao, acl, EVMScriptRegistry }
}

const newApp = async (dao, baseAppAddress, rootAccount) => {
  const receipt = await dao.newAppInstance(
    hash(`myname.aragonpm.test`), 
    baseAppAddress,
    '0x',
    false,
    {from: rootAccount}
  )

  // Find the deployed proxy address in the tx logs.
  const {logs} = receipt
  const log = logs.find((l) => l.event === 'NewAppProxy')
  const proxyAddress = log.args.proxy

  return proxyAddress
}

module.exports = {
  newDao,
  newApp,
  APP_ID,
  ANY_ADDRESS
}

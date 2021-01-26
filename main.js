'use strict'

/*
 * Created with @iobroker/create-adapter v1.9.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core')
const { captureRejectionSymbol } = require('events')
// Time Modules
const cron = require('node-cron') // Cron Schedulervar
const { allowedNodeEnvironmentFlags } = require('process')

const ObjectSettings = require('./ObjectSettings.js')
class Virtualpowermeter extends utils.Adapter {
  /**
   * @param {Partial<utils.AdapterOptions>} [options={}]
   */
  constructor(options) {
    super({
      ...options,
      name: 'virtualpowermeter'
    })
    this._GroupPrecisionEnergys = {}
    this._dicDatas = {}
    this._doingInitial = false
    this.on('ready', this.onReady.bind(this))
    this.on('objectChange', this.onObjectChange.bind(this))
    this.on('stateChange', this.onStateChange.bind(this))
    // this.on('message', this.onMessage);
    this.on('unload', this.onUnload.bind(this))
  }

  /**
  * Is called when databases are connected and adapter received configuration.
  */
  async onReady() {
    if (this.config.defaultPowerName === undefined) {
      this.config.defaultPowerName = 'Virtual_Energy_Power'
    }
    if (this.config.defaultEnergyName === undefined) {
      this.config.defaultEnergyName = 'Virtual_Energy_Total'
    }
    await this._initialObjects()
    this.subscribeForeignObjects('*')
    // repeat evey minute the calculation of the totalEnergy
    cron.schedule('* * * * *', async () => {
      if (!this._doingInitial) {
        this.log.debug('cron started')
        for (let oneOD in this._dicDatas) {
          await this._setEnergy(this._dicDatas[oneOD])
        }
        for (let group of await this._getGroupNames(false)) {
          await this._setGroupEnergy(group)
        }
      }
    })
  }

  /**
  * Is called if a subscribed object changes
  * @param {string} id
  * @param {ioBroker.Object | null | undefined} obj
  */
  async onObjectChange(id, obj) {
    if (await this._initialObject(obj)) {
      await this._reInitAllGroups()
    }
  }

  /**
  * Is called if a subscribed state changes
  * @param {string} id
  * @param {ioBroker.State | null | undefined} state
  */
  async onStateChange(id, state) {
    if (state && !this._doingInitial) {
      this.log.debug(id + ' state changed')
      let oS = this._dicDatas[id]
      if (oS && oS !== undefined) {
        await this._setPower(oS)
        await this._setGroupPower(oS.group)
      }
    }
  }
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  /**
  * create for every enabled object the needed stats and set it to initial it
  */
  async _initialObjects() {
    // wait finish old initial, otherwise  multiple Initial mixed

    await this.subscribeForeignObjectsAsync('*')

    this.log.info('inital all Objects')
    // all unsubscripe to begin completly new
    await this.unsubscribeForeignStatesAsync('*')
    // delete all dics
    this._dicDatas = {}
    // read out all Objects
    let objects = await this.getForeignObjectsAsync('')

    for (let idobject in objects) {
      await this._initialObject(objects[idobject])
    }
    await this._reInitAllGroups()
    this.log.info('initial completed')
  }

  async _checkIdInValid(id, containingID, DPName) {
    if (id && id !== '' && id.split('.').length >= 3 && !id.includes(' ') && !id.endsWith('.') && !id.startsWith('.')) {
      return false
    } else {
      this.log.error(`The Destination DP ${DPName} ('${id}') appears to be invalid (for ${containingID})`)
      return true
    }
  }

  /**
   *
   * @param {ioBroker.Object| null | undefined} iobrokerObject
   */
  async _initialObject(iobrokerObject) {
    if (this._doingInitial) {
      this.log.debug('wait')
      while (this._doingInitial) {
        await this._sleep(10)
      }
    }
    this._doingInitial = true

    let initialized = false
    if (iobrokerObject) {
      if (iobrokerObject._id in this._dicDatas) {
        await this.unsubscribeForeignStatesAsync(iobrokerObject._id)
        delete this._dicDatas[iobrokerObject._id]
        this.log.info('deinitilized ' + iobrokerObject._id)
        initialized = true
      }

      // only do something when enabled and MaxPowerset
      if (iobrokerObject && iobrokerObject.common && iobrokerObject.common.custom && iobrokerObject.common.custom[this.namespace] && iobrokerObject.common.custom[this.namespace].enabled && iobrokerObject.common.custom[this.namespace].maxpower) {
        if (isNaN(iobrokerObject.common.custom[this.namespace].maxpower)) {
          this.log.error(`Max Power from ${iobrokerObject._id} is not a number: "${iobrokerObject.common.custom[this.namespace].maxpower}"`)
        } else {
          // ###########
          // Migrate from pre 1.3.0
          // ###########
          // only do something when enabled and MaxPowerset
          if (iobrokerObject.common.custom[this.namespace].DPDestination === undefined) {
            if (!(String(iobrokerObject.common.custom[this.namespace].idEnergyPower).includes('.'))) {
              iobrokerObject.common.custom[this.namespace].DPDestination = 'inState'
            } else {
              iobrokerObject.common.custom[this.namespace].DPDestination = 'anywhere'
            }
            this.log.warn(`${iobrokerObject._id} migrate to new datastructure >=1.3.0 (DPDestination: ${iobrokerObject.common.custom[this.namespace].DPDestination} )`)
            await this.unsubscribeForeignObjectsAsync('*')
            await this.setForeignObjectAsync(iobrokerObject._id, iobrokerObject)
            await this.subscribeForeignObjectsAsync('*')
          }
          // ###########
          // End Migrate
          // ###########

          this.log.info('initial ' + iobrokerObject._id)
          var oS = new ObjectSettings(iobrokerObject, this.namespace, this.config.defaultPowerName, this.config.defaultEnergyName)

          let cancelInit = false
          cancelInit = await this._checkIdInValid(oS.idPower, oS.id, 'Power') || cancelInit
          cancelInit = await this._checkIdInValid(oS.idEnergy, oS.id, 'Energy') || cancelInit

          if (oS.idPower === oS.idEnergy) {
            this.log.error(`The Destination DP Power ('${oS.idPower}') is equal to the Destination DP Energy for ${oS.id}`)
            cancelInit = true
          }
          for (let oneOther in this._dicDatas) {
            /**
             * @type {ObjectSettings}
             */
            let otheroS = this._dicDatas[oneOther]
            if (oS.idEnergy === otheroS.idEnergy || oS.idEnergy === otheroS.idPower) {
              this.log.error(`The Destination DP Energy ('${oS.idEnergy}') for ${oS.id} is equal with a Destination DP for ${otheroS.id}`)
              cancelInit = true
            } else if (oS.idPower === otheroS.idEnergy || oS.idPower === otheroS.idPower) {
              this.log.error(`The Destination DP Power ('${oS.idPower}') for ${oS.id} is equal with a Destination DP for ${otheroS.id}`)
              cancelInit = true
            }
          }
          if (cancelInit === false) {
            await this._createObjectsForId(oS)
            this.log.debug('subscribeForeignStates ' + oS.id)
            this._dicDatas[oS.id] = oS
            await this.subscribeForeignStatesAsync(oS.id)
            await this._setPower(oS)
            this.log.info(`initial done ${iobrokerObject._id} Destination Power: ${oS.idPower} Destination EnergyTotal: ${oS.idEnergy} Destination Group:  ${await this._getgroupid(oS.group)}`)
            initialized = true
          }
        }
      }
    }
    this._doingInitial = false

    return initialized
  }

  /**
  * Berechnet anhand des zu überwachenden Object * maxpower die Aktuelle Leistung (Wenn max angegen ist wird value / max genommen)
  * @param {ObjectSettings} oS
  */
  async _setPower(oS) {
    // first recalc the current Energy because it use the timestam and the currentPower
    await this._setEnergy(oS)

    let newPower = 0
    // Den State auslesen (z.B. true/false oder 0%,20%,100%)
    let objState = await this.getForeignStateAsync(oS.id)
    if (objState) {
      let theValueAbsolut = Number(objState.val) * oS.multi
      if (oS.inverted) {
        theValueAbsolut = (theValueAbsolut - 1) * -1
      }
      newPower = theValueAbsolut * oS.maxpower
    }
    oS.currentPower = newPower
    this.log.debug(`set ${oS.id} value  ${oS.currentPowerRounded}`)
    await this.setForeignStateAsync(oS.idPower, { val: oS.currentPowerRounded, ack: true })
  }

  async _AddEnergyToDatapoint(idEnergy, currentPrecisionEnergy, currentPower,  ) {
    let oldEnergy = 0
    let oldts = new Date().getTime()
    // EnergyTotal auslesen, timestamp und aktueller wert wird benötigt
    let objidEnergy = await this.getForeignStateAsync(idEnergy)
    if (objidEnergy) {
      if (objidEnergy.val == await this._round(currentPrecisionEnergy)) {
        oldEnergy = currentPrecisionEnergy
      } else {
        oldEnergy = Number(objidEnergy.val)
      }
      oldts = objidEnergy.ts
    }
    // berechnen wieviel wh dazukommen 
    let newts = new Date().getTime()

    let toAddEnergyTotal = currentPower * (newts - oldts) / 3600000
    let newPrecisionEnergy = oldEnergy + toAddEnergyTotal
    // neuen wert setzen
    this.log.debug(`set ${idEnergy} value ${await this._round(newPrecisionEnergy)} (added:${await this._round(toAddEnergyTotal)})`)
    await this.setForeignStateAsync(idEnergy, { val: await this._round(newPrecisionEnergy), ts:newts, ack: true })
    return newPrecisionEnergy

  }
  /**
  * calc the Total Energy size the last Change and add it
  * @param {ObjectSettings} oS
  */
  async _setEnergy(oS) {
    oS.currentEnergy = await this._AddEnergyToDatapoint(oS.idEnergy, oS.currentEnergy, oS.currentPower)
  }

  async _round(val) {
    return Math.round(val * 100) / 100
  }

  /**
  * create Datapoints needed for a datapoint
  * @param {ObjectSettings} oS
  */
  async _createObjectsForId(oS) {
    this.log.debug(`create Datapoints for  ${oS.id} if not exists`)
    await this._createOrExtendObject(oS.idPower, {
      type: 'state',
      common: {
        name: oS.iobrokerObject.common.name + '.Virtual_Energy_Power',
        role: 'value.power.virtual',
        type: 'number',
        desc: `Power for DP: ${oS.id} - Created by virtualpowermeter`,
        unit: 'Watt',
        read: true,
        write: false
      },
      native: {}
    })
    await this._createOrExtendObject(oS.idEnergy, {
      type: 'state',
      common: {
        name: oS.iobrokerObject.common.name + '.Virtual_Energy_Total',
        role: 'value.power.consumption.virtual',
        type: 'number',
        desc: `Energy for DP: ${oS.id} - Created by virtualpowermeter`,
        unit: 'Wh',
        read: true,
        write: false
      },
      native: {}
    })

    this.log.debug(`create group Datapoints ${oS.group} if not exists`)
    await this._createOrExtendObject(await this._getgroupPowerid(oS.group), {
      type: 'state',
      common: {
        name: await this._getgroupPowerid(oS.group),
        role: 'value.power.virtual.group',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Watt',
        read: true,
        write: false
      },
      native: {}
    })
    await this._createOrExtendObject(await this._getgroupEnergyid(oS.group), {
      type: 'state',
      common: {
        name: await this._getgroupEnergyid(oS.group),
        role: 'value.power.consumption.virtual.group',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Wh',
        read: true,
        write: false
      },
      native: {}
    })
    await this._createOrExtendObject(await this._getgroupInfoid(oS.group), {
      type: 'state',
      common: {
        name: await this._getgroupInfoid(oS.group),
        role: 'text',
        type: 'string',
        desc: 'Created by virtualpowermeter',
        read: true,
        write: false
      },
      native: {}
    })
  }

  /**
   * create Datapoints needed for a datapoint
   * @param {string} id
   * @param {object} obj
   */
  async _createOrExtendObject(id, obj) {
    this.log.debug(`create ${id} if not exists`)
    let oldObject = await this.getForeignObjectAsync(id)
    if (!oldObject) {
      this.log.info(`create ${id}`)
      await this.setForeignObjectAsync(id, obj)
    } else if (oldObject.common.desc !== obj.common.desc) {
      this.log.info(`update desc for ${id} (old:'${oldObject.common.desc}' new: '${obj.common.desc}')`)
      oldObject.common.desc = obj.common.desc
      await this.setForeignObjectAsync(id, oldObject)
    }
  }

  async _getGroupMembers(group) {
    let ret = []
    for (let id in this._dicDatas) {
      let oS = this._dicDatas[id]
      if (oS.group === group) {
        ret.push(oS.id)
      }
    }
    return ret
  }

  async _getGroupNames(withInactive) {
    let ret = []
    for (let id in this._dicDatas) {
      let oS = this._dicDatas[id]
      if (ret.indexOf(oS.group) < 0) {
        ret.push(oS.group)
      }
    }
    if (withInactive) {
      let groupinfoobjects = await this.getForeignObjectsAsync(this.namespace + '.group_*.info')
      for (let onegroupinfo in groupinfoobjects) {
        let group = onegroupinfo.split('.')[2].substring('group_'.length)
        if (await this.getForeignObjectsAsync(await this._getgroupEnergyid(group)) && await this.getForeignObjectsAsync(await this._getgroupPowerid(group))) {
          if (ret.indexOf(group) < 0) {
            ret.push(group)
          }
        }
      }
    }
    return ret
  }

  async _reInitAllGroups() {
    for (let group of await this._getGroupNames(true)) {
      await this._setGroupPower(group)
      await this._setGroupInfo(group)
    }
  }

  /**
  * set the groupinfo per group with the watched ids
  * @param {string} group
  */
  async _setGroupInfo(group) {
    let groupmembers = await this._getGroupMembers(group)

    let info = groupmembers.join(';')
    this.log.debug(`set ${await this._getgroupInfoid(group)} value : ${info}`)
    await this.setStateAsync(await this._getgroupInfoid(group), { val: info, ack: true })
  }

  /**
  * Add  TotalEnergy and set the State
  * @param {string} group
  */
  async _setGroupEnergy(group) {
    let currentPowerState = await this.getForeignStateAsync(await this._getgroupPowerid(group))
    let currentPower = 0
    if (currentPowerState && currentPowerState.val && !Number.isNaN(currentPowerState.val)) {
      currentPower = Number(currentPowerState.val)
    }
    this._GroupPrecisionEnergys[group] = await this._AddEnergyToDatapoint(await this._getgroupEnergyid(group), this._GroupPrecisionEnergys[group], currentPower)
  }

  /**
  * Add all Power per group and set the State per group
  * @param {string} group
  */
  async _setGroupPower(group) {
    if (!this._doingInitial) {
      await this._setGroupEnergy(group)

      let sum = 0
      for (let id of await this._getGroupMembers(group)) {
        sum += this._dicDatas[id].currentPower
      }
      sum = await this._round(sum)
      this.log.debug(`set ${await this._getgroupPowerid(group)} value : ${sum}`)
      await this.setStateAsync(await this._getgroupPowerid(group), { val: sum, ack: true })
    }
  }

  async _getgroupid(group) {
    return `${this.namespace}.group_${group}.`
  }
  async _getgroupPowerid(group) {
    return `${await this._getgroupid(group)}Virtual_Energy_Power_group_${group}`
  }
  async _getgroupEnergyid(group) {
    return `${await this._getgroupid(group)}Virtual_Energy_Total_group_${group}`
  }
  async _getgroupInfoid(group) {
    return await this._getgroupid(group) + 'info'
  }

  /**
  * Is called when adapter shuts down - callback has to be called under any circumstances!
  * @param {() => void} callback
  */
  async onUnload(callback) {
    try {
      this.log.info('cleaned everything up...')
      await this.unsubscribeForeignStatesAsync('*')
      await this.unsubscribeForeignObjectsAsync('*')
      callback()
    } catch (e) {
      callback()
    }
  }
}
// @ts-ignore parent is a valid property on module
if (module.parent) {
  // Export the constructor in compact mode
  /**
  * @param {Partial<utils.AdapterOptions>} [options={}]
  */
  module.exports = (options) => new Virtualpowermeter(options)
} else {
  //  otherwise start the instance directly
  new Virtualpowermeter()
}

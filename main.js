'use strict'

/*
 * Created with @iobroker/create-adapter v1.9.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core')
// Time Modules
const cron = require('node-cron') // Cron Schedulervar

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

    this.dicDatas = {}
    this.dicGroups = {}
    this.doingInitial = false
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
    await this.initialObjects()
    this.subscribeForeignObjects('*')
    // repeat evey minute the calculation of the totalEnergy
    cron.schedule('* * * * *', async() => {
      if (!this.doingInitial) {
        this.log.debug('cron started')
        for (let oneOD in this.dicDatas) {
          await this.setEnergy(this.dicDatas[oneOD])
        }
        await this.setGroupEnergyAll()
      }
    })
  }

  /**
  * Is called if a subscribed object changes
  * @param {string} id
  * @param {ioBroker.Object | null | undefined} obj
  */
  async onObjectChange(id, obj) {
    let settingsforme = (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace])
    let oldsettingsexist = (id in this.dicDatas)
    if (settingsforme || oldsettingsexist) { await this.initialObjects() }
  }

  /**
  * Is called if a subscribed state changes
  * @param {string} id
  * @param {ioBroker.State | null | undefined} state
  */
  async onStateChange(id, state) {
    if (state && !this.doingInitial) {
      this.log.debug(id + ' state changed')
      let oS = this.dicDatas[id]
      if (oS && oS !== undefined) {
        await this.setEnergy(oS)
        await this.setPower(oS)
        await this.setGroupPower(oS.group)
        await this.setGroupEnergy(oS.group)
      }
    }
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  /**
  * create for every enabled object the needed stats and set it to initial it
  */
  async initialObjects() {
    // wait finish old initial, otherwise  multiple Initial mixed
    if (this.doingInitial) {
      this.log.info(`wait for init!!!`)
      while (this.doingInitial) {
        await this.sleep(500)
      }
    }

    this.doingInitial = true
    this.log.info('inital all Objects')
    // all unsubscripe to begin completly new
    await this.unsubscribeForeignStatesAsync('*')
    // delete all dics
    this.dicGroups = {}
    this.dicDatas = {}
    // read out all Objects
    let objects = await this.getForeignObjectsAsync('')
    // ###########
    // Migrate from pre 1.3.0
    // ###########
    for (let idobject in objects) {
      let iobrokerObject = objects[idobject]
      // only do something when enabled and MaxPowerset
      if (iobrokerObject && iobrokerObject.common && iobrokerObject.common.custom && iobrokerObject.common.custom[this.namespace] && iobrokerObject.common.custom[this.namespace].enabled && iobrokerObject.common.custom[this.namespace].maxpower) {
        if (iobrokerObject.common.custom[this.namespace].DPDestination === undefined) {
          if (!(String(iobrokerObject.common.custom[this.namespace].idEnergyPower).includes('.'))) {
            iobrokerObject.common.custom[this.namespace].DPDestination = 'inState'
          } else {
            iobrokerObject.common.custom[this.namespace].DPDestination = 'anywhere'
          }
          this.log.info(`${idobject} migrate to new datastructure >=1.3.0 (DPDestination: ${iobrokerObject.common.custom[this.namespace].DPDestination} )`)
          await this.setForeignObjectAsync(idobject, iobrokerObject)
        }
      }
    }
    // ###########
    // End Migrate
    // ###########
    for (let idobject in objects) {
      let iobrokerObject = objects[idobject]
      // only do something when enabled and MaxPowerset
      if (iobrokerObject && iobrokerObject.common && iobrokerObject.common.custom && iobrokerObject.common.custom[this.namespace] && iobrokerObject.common.custom[this.namespace].enabled && iobrokerObject.common.custom[this.namespace].maxpower) {
        if (isNaN(iobrokerObject.common.custom[this.namespace].maxpower)) {
          this.log.error('Max Power from ' + iobrokerObject._id + ' is not a number: "' + iobrokerObject.common.custom[this.namespace].maxpower + '"')
        } else {
          this.log.info('initial (enabled and maxPower OK): ' + iobrokerObject._id)
          var oS = new ObjectSettings(iobrokerObject, this.namespace, this.config.defaultPowerName, this.config.defaultEnergyName)

          let cancelInit = false

          if (!oS.idPower.includes('.')) {
            this.log.error(`The Destination DP Power ('${oS.idPower}') seems to be invalid(${oS.id})`)
            cancelInit = true
          }
          if (!oS.idEnergy.includes('.')) {
            this.log.error(`The Destination DP Energy ('${oS.idEnergy}') seems to be invalid(${oS.id})`)
            cancelInit = true
          }

          if (oS.idPower === oS.idEnergy) {
            this.log.error(`The Destination DP Power ('${oS.idPower}') is equal to the Destination DP Energy for ${oS.id}`)
            cancelInit = true
          }
          for (let oneOther in this.dicDatas) {
            /**
             * @type {ObjectSettings}
             */
            let otheroS = this.dicDatas[oneOther]
            if (oS.idEnergy === otheroS.idEnergy || oS.idEnergy === otheroS.idPower) {
              this.log.error(`The Destination DP Energy ('${oS.idEnergy}') for ${oS.id} is equal with a Destination DP for ${otheroS.id}`)
              cancelInit = true
            } else if (oS.idPower === otheroS.idEnergy || oS.idPower === otheroS.idPower) {
              this.log.error(`The Destination DP Power ('${oS.idPower}') for ${oS.id} is equal with a Destination DP for ${otheroS.id}`)
              cancelInit = true
            }
          }
          if (cancelInit === false) {
            // needed for group calculations
            if (!(oS.group in this.dicGroups)) {
              this.dicGroups[oS.group] = {}
            }
            this.dicGroups[oS.group][oS.id] = {}

            await this.createObjectsForId(oS)
            this.log.debug('subscribeForeignStates ' + oS.id)
            this.dicDatas[oS.id] = oS
            await this.subscribeForeignStatesAsync(oS.id)
            await this.setEnergy(oS)
            await this.setPower(oS)
            this.log.info('initial done ' + iobrokerObject._id + ' Destination Power: ' + oS.idPower + ' Destination EnergyTotal: ' + oS.idEnergy + ' Destination Group: ' + oS.idGroup)
          }
        }
      }
    }
    this.doingInitial = false
    await this.setGroupPowerAll()
    await this.setGroupEnergyAll()
    await this.setGroupInfo()
    this.log.info('initial completed')
  }

  /**
  * Berechnet anhand des zu überwachenden Object * maxpower die Aktuelle Leistung (Wenn max angegen ist wird value / max genommen)
  * @param {ObjectSettings} oS
  */
  async setPower(oS) {
    let newPower = 0
    // Den State auslesen (z.B. true/false oder 0%,20%,100%)
    let objState = await this.getForeignStateAsync(oS.id)
    if (objState) {
      let theValueAbsolut = Number(objState.val) * oS.multi
      if (oS.inverted) {
        theValueAbsolut = (theValueAbsolut - 1) * -1
      }
      newPower = theValueAbsolut * oS.maxpower
      oS.currentPower = Math.round(newPower * 100) / 100
    }
    this.log.debug(oS.id + ' set ' + oS.currentPower)
    await this.setForeignStateAsync(oS.idPower, { val: newPower, ack: true })
  }

  /**
  * calc the Total Energy size the last Change and add it
  * @param {ObjectSettings} oS
  */
  async setEnergy(oS) {
    let oldEnergy = 0
    let oldts = new Date().getTime()
    // EnergyTotal auslesen, timestamp und aktueller wert wird benötigt
    let objidEnergy = await this.getForeignStateAsync(oS.idEnergy)
    if (objidEnergy) {
      oldEnergy = Number(objidEnergy.val)
      oldts = objidEnergy.ts
    }
    // berechnen wieviel wh dazukommen (alles auf 2 nachkomma runden)
    let toAddEnergyTotal = Math.round(oS.currentPower * (new Date().getTime() - oldts) / 3600000 * 100) / 100
    oS.currentEnergy = Math.round((oldEnergy + toAddEnergyTotal) * 100) / 100
    // neuen wert setzen
    this.log.debug(oS.idEnergy + ' set ' + oS.currentEnergy + ' (added:' + toAddEnergyTotal + ')')
    await this.setForeignStateAsync(oS.idEnergy, { val: oS.currentEnergy, ack: true })
  }

  /**
  * create Datapoints needed for a datapoint
  * @param {ObjectSettings} oS
  */
  async createObjectsForId(oS) {
    this.log.debug('create Datapoints for  ' + oS.id + ' if not exists')

    this.log.debug('create ' + oS.idPower + ' if not exists')
    await this.setForeignObjectNotExistsAsync(oS.idPower, {
      type: 'state',
      common: {
        name: oS.iobrokerObject.common.name + '.Virtual_Energy_Power',
        role: 'value.power.virtual',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Watt',
        read: true,
        write: false
      },
      native: {}
    })

    this.log.debug('create ' + oS.idEnergy + ' if not exists')
    await this.setForeignObjectNotExistsAsync(oS.idEnergy, {
      type: 'state',
      common: {
        name: oS.iobrokerObject.common.name + '.Virtual_Energy_Total',
        role: 'value.power.consumption.virtual',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Wh',
        read: true,
        write: false
      },
      native: {}
    })
    this.log.debug('create Datapoints for group ' + oS.group + ' if not exists')

    this.log.debug('create ' + oS.idGroupPower + ' if not exists')
    await this.setObjectNotExistsAsync(oS.idGroupPower, {
      type: 'state',
      common: {
        name: oS.idGroupPower,
        role: 'value.power.virtual.group',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Watt',
        read: true,
        write: false
      },
      native: {}
    })

    this.log.debug('create ' + oS.idGroupEnergy + ' if not exists')
    await this.setObjectNotExistsAsync(oS.idGroupEnergy, {
      type: 'state',
      common: {
        name: oS.idGroupEnergy,
        role: 'value.power.consumption.virtual.group',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Wh',
        read: true,
        write: false
      },
      native: {}
    })

    this.log.debug('create ' + oS.idGroupInfo + ' if not exists')
    await this.setObjectNotExistsAsync(oS.idGroupInfo, {
      type: 'state',
      common: {
        name: oS.idGroupInfo,
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
  * set the groupinfo per group with the watched ids
  */
  async setGroupInfo() {
    if (!this.doingInitial) {
      for (let group in this.dicGroups) {
        let info = ''
        let idGroupInfo
        for (let id in this.dicGroups[group]) {
          info += id + ';'
          idGroupInfo = this.dicDatas[id].idGroupInfo
        }
        this.log.debug('setze ' + idGroupInfo + ' auf : ' + info)
        await this.setStateAsync(idGroupInfo, { val: info, ack: true })
      }
    }
  }
  /**
  * Add all TotalEnergy per group and set the State per group
  */
  async setGroupEnergyAll() {
    for (let group in this.dicGroups) {
      await this.setGroupEnergy(group)
    }
  }

  /**
  * Add  TotalEnergy and set the State
  * @param {string} group
  */
  async setGroupEnergy(group) {
    if (!this.doingInitial) {
      let gesamt = 0
      let idGroupEnergy
      for (let id in this.dicGroups[group]) {
        gesamt += this.dicDatas[id].currentEnergy
        idGroupEnergy = this.dicDatas[id].idGroupEnergy
      }
      gesamt = Math.round(gesamt * 100) / 100

      if (this.config.groupEnergieMustBeGreater) {
        let oldState = await this.getStateAsync(idGroupEnergy)

        if (oldState && oldState.val) {
          if (gesamt >= oldState.val) {
            await this.setStateAsync(idGroupEnergy, { val: gesamt, ack: true })
          } else {
            this.log.warn(`group ${group}: old value '${oldState.val}' is greater than new value '${gesamt}' -> no action`)
          }
        } else {
          this.log.debug('setze ' + idGroupEnergy + ' auf : ' + gesamt)
          await this.setStateAsync(idGroupEnergy, { val: gesamt, ack: true })
        }
      } else {
        this.log.debug('setze ' + idGroupEnergy + ' auf : ' + gesamt)
        await this.setStateAsync(idGroupEnergy, { val: gesamt, ack: true })
      }
    }
  }

  /**
  * Add all Power per group and set the State per group
  */
  async setGroupPowerAll() {
    for (let group in this.dicGroups) {
      this.setGroupPower(group)
    }
  }
  /**
  * Add all Power per group and set the State per group
  * @param {string} group
  */
  async setGroupPower(group) {
    if (!this.doingInitial) {
      let sum = 0
      let idGroupPower
      for (let id in this.dicGroups[group]) {
        sum += this.dicDatas[id].currentPower
        idGroupPower = this.dicDatas[id].idGroupPower
      }
      this.log.debug('setze ' + idGroupPower + ' auf : ' + sum)
      await this.setStateAsync(idGroupPower, { val: Math.round(sum * 100) / 100, ack: true })
    }
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
  // otherwise start the instance directly
  new Virtualpowermeter()
}

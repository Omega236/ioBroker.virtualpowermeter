'use strict'
/*
 * Created with @iobroker/create-adapter v1.9.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core')
// Time Modules
const cron = require('node-cron') // Cron Schedulervar

class Virtualpowermeter extends utils.Adapter {
  /**
  * @param {Partial<ioBroker.AdapterOptions>} [options={}]
  */
  constructor (options) {
    super({
      ...options,
      name: 'virtualpowermeter'
    })
    this.dicMultiId = {}
    this.on('ready', this.onReady.bind(this))
    this.on('objectChange', this.onObjectChange.bind(this))
    this.on('stateChange', this.onStateChange.bind(this))
    // this.on("message", this.onMessage);
    this.on('unload', this.onUnload.bind(this))
  }

  /**
  * Is called when databases are connected and adapter received configuration.
  */
  async onReady () {
    await this.initialObjects()
    this.subscribeForeignObjects('*')

    // repeat evey minute the calculation of the totalEnergy
    cron.schedule('* * * * *', async () => {
      this.log.debug('cron started')

      for (let idobject in this.dicMultiId) {
        await this.calcTotalEnergy(idobject)
      }
      await this.calcGroupTotalEnergy()
    })
  }

  /**
  * Is called if a subscribed object changes
  * @param {string} id
  * @param {ioBroker.Object | null | undefined} obj
  */
  async onObjectChange (id, obj) {
    let settingsforme = (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace])
    let oldsettingsexist = (id in this.dicMultiId)

    if (settingsforme || oldsettingsexist) { await this.initialObjects() }
  }

  /**
  * Is called if a subscribed state changes
  * @param {string} id
  * @param {ioBroker.State | null | undefined} state
  */
  async onStateChange (id, state) {
    if (state && (id in this.dicMultiId)) {
      this.log.info(id + ' state changed')
      await this.calcTotalEnergy(id)
      await this.setPowerForId(id)
      await this.setUpdateTimestampEnergyTotal(id)
      await this.calcGroupPower()
      await this.calcGroupTotalEnergy()
    }
  }

  /**
  * create for every enabled object the needed stats and set it to initial it
  */
  async initialObjects () {
    this.log.info('inital all Objects')

    // all unsubscripe to begin completly new
    this.unsubscribeForeignStates('*')
    // delete all dics
    this.dicMultiId = {}
    this.dicGroupId = {}
    this.dicTotalEnergyGroupId = {}
    this.dicPowerGroupId = {}
    // read out all Objects
    let objects = await this.getForeignObjectsAsync('')
    for (let idobject in objects) {
      let iobrokerObject = objects[idobject]
      // only do something when enabled and MaxPowerset
      if (iobrokerObject && iobrokerObject.common && iobrokerObject.common.custom && iobrokerObject.common.custom[this.namespace] && iobrokerObject.common.custom[this.namespace].enabled && iobrokerObject.common.custom[this.namespace].maxpower && !isNaN(iobrokerObject.common.custom[this.namespace].maxpower)) {
        this.log.info('initial (enabled and maxPower OK): ' + iobrokerObject._id)

        let group = 'undefinied'
        if (iobrokerObject.common.custom[this.namespace].group) {
          group = iobrokerObject.common.custom[this.namespace].group
        }
        await this.createObjectForGroup(group)

        // dic_group for the id set
        // @ts-ignore
        this.dicGroupId[iobrokerObject._id] = group

        // needed for group calculations
        if (!(group in this.dicTotalEnergyGroupId)) {
          // @ts-ignore
          this.dicTotalEnergyGroupId[group] = {}
        }
        // @ts-ignore
        this.dicTotalEnergyGroupId[group][iobrokerObject._id] = 0

        // needed for group calculations
        if (!(group in this.dicPowerGroupId)) {
          // @ts-ignore
          this.dicPowerGroupId[group] = {}
        }
        // @ts-ignore
        this.dicPowerGroupId[group][iobrokerObject._id] = 0

        // calculate the Muliplikator for the state (Dimmer 60W: Multi 0.6, State 60W: Multi 60)
        let Multi = 1
        // wenn max wert gibt, dann kann dies verwendet werden
        if (iobrokerObject.common.max) { Multi = Multi / iobrokerObject.common.max }
        // @ts-ignore
        this.dicMultiId[iobrokerObject._id] = Multi * iobrokerObject.common.custom[this.namespace].maxpower

        await this.createObjectsForId(iobrokerObject)
        this.log.debug('subscribeForeignStates ' + iobrokerObject._id)
        await this.subscribeForeignStatesAsync(iobrokerObject._id)
        await this.setPowerForId(iobrokerObject._id)
        await this.calcTotalEnergy(iobrokerObject._id)
        this.log.debug('initial done ' + iobrokerObject._id)
      }
    }
    await this.calcGroupPower()
    await this.calcGroupTotalEnergy()
    await this.setGroupInfo()
    this.log.info('initial completed')
  }

  /**
  * Berechnet anhand des zu überwachenden Object * maxpower die Aktuelle Leistung (Wenn max angegen ist wird value / max genommen)
  * @param {string} id
  */
  async setPowerForId (id) {
    let newPower = 0
    // Den State auslesen (z.B. true/false oder 0%,20%,100%)
    let objState = await this.getForeignStateAsync(id)
    if (objState) {
      // @ts-ignore
      let Multi = this.dicMultiId[id]
      newPower = objState.val * Multi
      newPower = Math.round(newPower * 100) / 100
    }
    this.log.debug(id + ' set ' + newPower)
    // needed for groupCalculation
    // @ts-ignore
    this.dicPowerGroupId[this.dicGroupId[id]][id] = newPower
    await this.setForeignStateAsync(this.getIdPower(id), { val: newPower, ack: true })
  }

  /**
  * Den Timestamp von Energy_Total auf jetzt setzen (für berechnung notwendig)
  * @param {string} id
  */
  async setUpdateTimestampEnergyTotal (id) {
    this.log.debug(id + ' update timestamp')
    await this.setForeignStateAsync(this.getIdEnergyTotal(id), { ts: new Date().getTime(), ack: true })
  }

  /**
  * calc the Total Energy size the last Change and add it
  * @param {string} id
  */
  async calcTotalEnergy (id) {
    // Die Aktuelle Power auslesen
    let objEnergyPower = await this.getForeignStateAsync(this.getIdPower(id))
    if (objEnergyPower) {
      let idobjEnergyTotal = this.getIdEnergyTotal(id)
      // EnergyTotal auslesen, timestamp und aktueller wert wird benötigt
      let objEnergyTotal = await this.getForeignStateAsync(idobjEnergyTotal)
      if (objEnergyTotal) {
        // berechnen wieviel kwh dazukommen (alles auf 2 nachkomma runden)
        let toAddEnergyTotal = Math.round(objEnergyPower.val * (((new Date().getTime()) - objEnergyTotal.ts) / 3600000) * 100) / 100
        let newEnergyTotal = Math.round((objEnergyTotal.val + toAddEnergyTotal) * 100) / 100
        // needed for groupCalculation
        // @ts-ignore
        this.dicTotalEnergyGroupId[this.dicGroupId[id]][id] = newEnergyTotal
        if (toAddEnergyTotal > 0) {
          // neuen wert setzen
          this.log.debug(idobjEnergyTotal + ' set ' + newEnergyTotal + ' (added:' + toAddEnergyTotal + ')')
          await this.setForeignStateAsync(idobjEnergyTotal, { val: newEnergyTotal, ack: true })
        }
      }
    }
  }

  /**
  * create Datapoints needed for a datapoint
  * @param {ioBroker.Object} iobrokerObject
  */
  async createObjectsForId (iobrokerObject) {
    this.log.debug('create Datapoints for group ' + iobrokerObject + ' if not exists')

    this.log.debug('create ' + this.getIdPower(iobrokerObject._id) + ' if not exists')
    await this.setForeignObjectNotExistsAsync(this.getIdPower(iobrokerObject._id), {
      type: 'state',
      common: {
        name: iobrokerObject.common.name + '.Virtual_Energy_Power',
        role: 'value.power.virtual',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Watt',
        read: true,
        write: true,
        def: 0
      },
      native: {}
    })

    this.log.debug('create ' + this.getIdEnergyTotal(iobrokerObject._id) + ' if not exists')
    await this.setForeignObjectNotExistsAsync(this.getIdEnergyTotal(iobrokerObject._id), {
      type: 'state',
      common: {
        name: iobrokerObject.common.name + '.Virtual_Energy_Total',
        role: 'value.power.consumption.virtual',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Wh',
        read: true,
        write: true,
        def: 0
      },
      native: {}
    })
  }

  /**
  * create Datapoints needed for group
  * @param {string} group
  */
  async createObjectForGroup (group) {
    this.log.debug('create Datapoints for group ' + group + ' if not exists')

    this.log.debug('create ' + this.getIdGroupPower(group) + ' if not exists')
    await this.setObjectNotExists(this.getIdGroupPower(group), {
      type: 'state',
      common: {
        name: this.getIdGroupPower(group),
        role: 'value.power.virtual.group',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Watt',
        read: true,
        write: true,
        def: 0
      },
      native: {}
    })

    this.log.debug('create ' + this.getIdGroupTotalEnergy(group) + ' if not exists')
    await this.setObjectNotExists(this.getIdGroupTotalEnergy(group), {
      type: 'state',
      common: {
        name: this.getIdGroupTotalEnergy(group),
        role: 'value.power.consumption.virtual.group',
        type: 'number',
        desc: 'Created by virtualpowermeter',
        unit: 'Wh',
        read: true,
        write: true,
        def: 0
      },
      native: {}
    })

    this.log.debug('create ' + this.getIdGroupInfo(group) + ' if not exists')
    await this.setObjectNotExists(this.getIdGroupInfo(group), {
      type: 'state',
      common: {
        name: this.getIdGroupInfo(group),
        type: 'string',
        desc: 'Created by virtualpowermeter',
        read: true,
        write: true
      },
      native: {}
    })
  }

  /**
  * set the groupinfo per group with the watched ids
  */
  async setGroupInfo () {
    for (let group in this.dicTotalEnergyGroupId) {
      let info = ''
      // @ts-ignore
      for (let id in this.dicTotalEnergyGroupId[group]) {
        info += id + ';'
      }
      this.log.debug('setze ' + this.getIdGroupInfo(group) + ' auf : ' + info)
      await this.setStateAsync(this.getIdGroupInfo(group), { val: info, ack: true })
    }
  }

  /**
  * Add all TotalEnergy per group and set the State per group
  */
  async calcGroupTotalEnergy () {
    for (let group in this.dicTotalEnergyGroupId) {
      let gesamt = 0
      // @ts-ignore
      for (let id in this.dicTotalEnergyGroupId[group]) {
        // @ts-ignore
        gesamt += this.dicTotalEnergyGroupId[group][id]
      }
      gesamt = Math.round(gesamt * 100) / 100
      this.log.debug('setze ' + this.getIdGroupTotalEnergy(group) + ' auf : ' + gesamt)
      await this.setStateAsync(this.getIdGroupTotalEnergy(group), { val: gesamt, ack: true })
    }
  }

  /**
  * Add all Power per group and set the State per group
  */
  async calcGroupPower () {
    for (let group in this.dicPowerGroupId) {
      let sum = 0
      // @ts-ignore
      for (let id in this.dicPowerGroupId[group]) {
        // @ts-ignore
        sum += this.dicPowerGroupId[group][id]
      }
      this.log.debug('setze ' + this.getIdGroupPower(group) + ' auf : ' + sum)
      await this.setStateAsync(this.getIdGroupPower(group), { val: Math.round(sum * 100) / 100, ack: true })
    }
  }

  /**
  * Gibt die ID für Virtual_Energy_Power zurück
  * @param {string} id
  */
  getIdPower (id) {
    return id.substr(0, id.lastIndexOf('.') + 1) + 'Virtual_Energy_Power'
  }

  /**
  * Gibt die ID für Virtual_Energy_Power zurück
  * @param {string} group
  */
  getIdGroupPower (group) {
    return this.namespace + '.group_' + group + '.Virtual_Energy_Power_group_' + group
  }

  /**
  * gibt die id für Virtual_Energy_Total zurück
  * @param {string} id
  */
  getIdEnergyTotal (id) {
    return id.substr(0, id.lastIndexOf('.') + 1) + 'Virtual_Energy_Total'
  }

  /**
  * Gibt die ID für Virtual_Energy_Power zurück
  * @param {string} group
  */
  getIdGroupTotalEnergy (group) {
    return this.namespace + '.group_' + group + '.Virtual_Energy_Total_group_' + group
  }
  /**
  * Gibt die ID für Virtual_Energy_Power zurück
  * @param {string} group
  */
  getIdGroupInfo (group) {
    return this.namespace + '.group_' + group + '.info'
  }

  /**
  * Is called when adapter shuts down - callback has to be called under any circumstances!
  * @param {() => void} callback
  */
  async onUnload (callback) {
    try {
      this.log.info('cleaned everything up...')
      callback()
    } catch (e) {
      callback()
    }
  }
}

if (module.parent) {
  // Export the constructor in compact mode
  /**
  * @param {Partial<ioBroker.AdapterOptions>} [options={}]
  */
  module.exports = (options) => new Virtualpowermeter(options)
} else {
  // otherwise start the instance directly
  new Virtualpowermeter()
}

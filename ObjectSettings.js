class ObjectSettings {
  /**
  * Generate new ObjectSettingsClass
  * @param {string} namespace
  * @param {ioBroker.Object } iobrokerObject
  */
  constructor (iobrokerObject, namespace) {
    this.id = iobrokerObject._id
    this.iobrokerObject = iobrokerObject
    this.group = iobrokerObject.common.custom[namespace].group
    this.inverted = iobrokerObject.common.custom[namespace].inverted
    this.maxpower = iobrokerObject.common.custom[namespace].maxpower
    this.multi = 1
    // @ts-ignore
    if (iobrokerObject.common.max) { this.multi = this.multi / iobrokerObject.common.max }
    this.idGroup = namespace + '.group_' + this.group + '.'
    this.idGroupPower = this.idGroup + 'Virtual_Energy_Power_group_' + this.group
    this.idGroupInfo = this.idGroup + 'info'
    this.idGroupEnergy = this.idGroup + 'Virtual_Energy_Total_group_' + this.group
    this.currentPower = 0
    this.currentEnergy = 0

    let idParent = this.id.substr(0, this.id.lastIndexOf('.') + 1)
    // if starts with ~ means Create under Group
    // only ~ means virtualpowermeter.0.group_xxx.ur_id.defaultEnergy_Power
    // empty like ~
    // if starts with . means Create under current
    // only . means ur.id.defaultEnergy_Power

    this.idPower = this.GenerateIDFromRelative(iobrokerObject.common.custom[namespace].idEnergyPower, idParent, this.idGroup, 'Virtual_Energy_Power')

    this.idEnergy = this.GenerateIDFromRelative(iobrokerObject.common.custom[namespace].idEnergyTotal, idParent, this.idGroup, 'Virtual_Energy_Total')
  }

  GenerateIDFromRelative (relativeID, idParent, idGroup, defaultname) {
    if (!relativeID.includes('.') && !relativeID.includes('~')) {
      relativeID = '.' + relativeID
    }
    if (relativeID.endsWith('~')) {
      relativeID += this.id.split('.').join('_') + '.'
    }
    if (relativeID.endsWith('.')) {
      relativeID += defaultname
    }
    if (relativeID.startsWith('.')) {
      relativeID = idParent + relativeID.substr(1)
    }
    if (relativeID.startsWith('~')) {
      if (relativeID.startsWith('~.')) {
        relativeID = relativeID.substr(1)
      }
      relativeID = idGroup + relativeID.substr(1)
    }
    return relativeID
  }
}
module.exports = ObjectSettings

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
    this.idGroupPower = namespace + '.group_' + this.group + '.Virtual_Energy_Power_group_' + this.group
    this.idGroupInfo = namespace + '.group_' + this.group + '.info'
    this.idGroupEnergy = namespace + '.group_' + this.group + '.Virtual_Energy_Total_group_' + this.group
    this.currentPower = 0
    this.currentEnergy = 0
    let idParent = this.id.substr(0, this.id.lastIndexOf('.') + 1)
    if (iobrokerObject.common.custom[namespace].idEnergyPower.includes('.')) {
      this.idPower = iobrokerObject.common.custom[namespace].idEnergyPower
    } else {
      this.idPower = idParent + iobrokerObject.common.custom[namespace].idEnergyPower
    }
    if (iobrokerObject.common.custom[namespace].idEnergyTotal.includes('.')) {
      this.idEnergy = iobrokerObject.common.custom[namespace].idEnergyTotal
    } else {
      this.idEnergy = idParent + iobrokerObject.common.custom[namespace].idEnergyTotal
    }
  }
}
module.exports = ObjectSettings

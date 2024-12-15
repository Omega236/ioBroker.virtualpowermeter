class ObjectSettings {
    /**
     * Generate new ObjectSettingsClass
     *
     * @param namespace
     * @param iobrokerObject
     * @param defaultPowerName
     * @param defaultEnergyName
     */
    constructor(iobrokerObject, namespace) {
        this.id = iobrokerObject._id;
        this.iobrokerObject = iobrokerObject;
        let mycustom = iobrokerObject.common.custom[namespace];
        this.group = mycustom.group;
        this.idGroup = `${namespace}.group_${this.group}.`;
        this.inverted = mycustom.inverted;
        this.maxpower = mycustom.maxpower;
        this.minpower = mycustom.minpower;
        this.multi = 1;
        if (iobrokerObject.common.max) {
            this.multi = this.multi / iobrokerObject.common.max;
        } else if (iobrokerObject.common.unit === '%') {
            this.multi = this.multi / 100;
        }
        this.currentPower = 0;
        this.currentEnergy = 0;

        let idParent = this.id.substr(0, this.id.lastIndexOf('.') + 1);
        // if starts with ~ means Create under Group
        // only ~ means virtualpowermeter.0.group_xxx.ur_id.defaultEnergy_Power
        // empty like ~
        // if starts with . means Create under current
        // only . means ur.id.defaultEnergy_Power

        this.DPDestination = mycustom.DPDestination;

        this.idPower = this.GenerateIDFromRelative(mycustom.idEnergyPower, idParent);

        this.idEnergy = this.GenerateIDFromRelative(mycustom.idEnergyTotal, idParent);

        this.idOptionalSwitch = null;
        if (mycustom.idOptionalSwitch && mycustom.idOptionalSwitch !== undefined && mycustom.idOptionalSwitch !== '') {
            this.idOptionalSwitch = String(mycustom.idOptionalSwitch);
            if (this.idOptionalSwitch.indexOf('.') < 0) {
                this.idOptionalSwitch = idParent + this.idOptionalSwitch;
            }
        }
    }

    get currentPowerRounded() {
        return this._round(this.currentPower);
    }

    get currentEnergyRounded() {
        return this._round(this.currentEnergy);
    }

    /**
     *
     * @param relativeID
     * @param idParent
     * @returns
     */
    GenerateIDFromRelative(relativeID, idParent) {
        if (this.DPDestination === 'inState') {
            if (relativeID.startsWith('.')) {
                relativeID = relativeID.substr(1);
            }
            relativeID = idParent + relativeID;
        } else if (this.DPDestination === 'inGroup') {
            if (relativeID.startsWith('.')) {
                relativeID = relativeID.substr(1);
            }
            relativeID = this.idGroup + relativeID;
        }
        // else if (this.DPDestination === 'anywhere') {
        // }
        return relativeID;
    }

    _round(val) {
        return Math.round(val * 100) / 100;
    }
}
module.exports = ObjectSettings;

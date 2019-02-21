"use strict";
/*
 * Created with @iobroker/create-adapter v1.9.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Time Modules
const cron = require("node-cron"); // Cron Schedulervar
var listOfObjects = ["a"];




class   Virtualpowermeter extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "virtualpowermeter"
		});
		this.on("ready", this.onReady);
		this.on("objectChange", this.onObjectChange);
		this.on("stateChange", this.onStateChange);
		// this.on("message", this.onMessage);
		this.on("unload", this.onUnload);
	}
	
	
	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.initialObjects();

		// Minütlich Total rechnen
		cron.schedule("* * * * *", async () => {
			for (var key in listOfObjects) {
				await this.Energy_Total_rechnenAsync(listOfObjects[ key]);
			}
		});
	}

	

	/**
	 *  hier werden für alle zu überwachenden Elemente: Datenpunkte erstellen, subscribe und Energy_Total_rechnenAsync
	 */
	async initialObjects()
	{
		//Alles unsubsciben so kann man diese funktion immer aufrufen
		await this.unsubscribeStatesAsync("*");
		listOfObjects = [];
		// alle Objekte auslesen
		var objects = await this.getForeignObjectsAsync("");
	
		
		for (var key in objects) {
			var iobrokerObject = objects[key];
			//Überprüfen ob die CustomEinstellung Enabled und MaxPower gesetzt ist
			if (iobrokerObject && iobrokerObject.common &&
				(
					(iobrokerObject.common.custom  && iobrokerObject.common.custom[this.namespace]  && iobrokerObject.common.custom[this.namespace].enabled && !isNaN( iobrokerObject.common.custom[this.namespace].maxpower))
				)) 
			{
				this.log.info("Erstelle Datenpunkte und Überwache " + iobrokerObject._id);
				await this.createVirtualPowerMeterObjectsAsync(iobrokerObject);	
				await this.subscribeForeignStatesAsync(iobrokerObject._id);
				await this.Energy_Total_rechnenAsync(iobrokerObject._id);
				listOfObjects.push(iobrokerObject._id);
				
				
			}	

		
		}	
		
	}


	/**
 	* Berechnet anhand des zu überwachenden Object * maxpower die Aktuelle Leistung (Wenn max angegen ist wird value / max genommen)
	* @param {string} id
	 */
	async Energy_Power_setzenAsync(id)	
	{
		//Das Objekt auslesn (wird für max power benötigt)
		var idObject = await this.getForeignObjectAsync(id);
		//Überprüfen ob Settings passen
		if (idObject && idObject.common && idObject.common.custom && idObject.common.custom[this.namespace].maxpower){
			//Den State auslesen (z.B. true/false oder 0%,20%,100%)
			var objState = await this.getForeignStateAsync(id)
			if (objState)
			{
				// den Multi berechnen (ist bei true/false bzw Dimmer unterschiedlich)
				var Multi = objState.val * 1;
				//wenn max wert gibt, dann kann dies verwendet werden
				if (idObject.common.max)
					Multi = Multi / idObject.common.max;
				// wenn ein Dimmer kein Max wert hat, ist der Wert automatisch über 1, dann wird einfach durch 100 geteilt
				if (Multi > 1)
					Multi = Multi / 100;
					
				var newPower =  Multi * idObject.common.custom[this.namespace].maxpower;
			
				await this.setForeignStateAsync(this.getIdVirtualEnergyPower(id), { val: newPower, ack: true });
			}
			

		}	
		
	}

	/**
 	* Den Timestamp von Energy_Total auf jetzt setzen (für berechnung notwendig)
	* @param {string} id
 	*/
 	async Energy_Total_updatetimestamp(id) {
		await	this.setForeignStateAsync(this.getIdVirtualEnergyTotal(id),{ ts: new Date().getTime(), ack:true } );
	}


	/**
 	* berechnet anhand der vergangen Zeit und der Power die EnergyTotal
	* @param {string} id
 	*/
 	async Energy_Total_rechnenAsync(id) {
		//Die Aktuelle Power auslesen
		var objEnergyPower = await this.getForeignStateAsync(this.getIdVirtualEnergyPower(id));
		if (objEnergyPower)	{
			var idobjEnergyTotal = this.getIdVirtualEnergyTotal(id);
			//EnergyTotal auslesen, timestamp und aktueller wert wird benötigt
			var objEnergyTotal = await this.getForeignStateAsync(idobjEnergyTotal);
			if (objEnergyTotal)
			{
				//berechnen wieviel kwh dazukommen (alles auf 2 nachkomma runden)
				var toAddEnergy_Total = Math.round(objEnergyPower.val * (((new Date().getTime()) - objEnergyTotal.ts) / 3600000) * 100) / 100;
				if (toAddEnergy_Total > 0)
				{
					var newEnergy_Total = Math.round((objEnergyTotal.val + toAddEnergy_Total) * 100)/100;
					//neuen wert setzen
					await this.setForeignStateAsync(idobjEnergyTotal,{ val: newEnergy_Total, ack: true } );
					this.log.info(idobjEnergyTotal + " auf " + newEnergy_Total + " gesetzt (added:" + toAddEnergy_Total + ")");
				}
			}
		}
	}

	/**
	 * Erstellt zu einem überwachendem Object die Datenpunkte Virtual_Energy_Power und Virtual_Energy_Total
	 * @param {ioBroker.Object} iobrokerObject
	 */
	async createVirtualPowerMeterObjectsAsync(iobrokerObject)
	{
		await this.setForeignObjectNotExistsAsync(this.getIdVirtualEnergyPower(iobrokerObject._id), {
				type: "state",
				common: {
					name: iobrokerObject.common.name	 + ".Virtual_Energy_Power",
					role: "value.power.virtual",
					type: "number",
					desc: "Created by virtualpowermeter",
					unit: "Watt",
					read: true,
					write: true,
					def : 0
				},
				native: {},
			});

		await this.setForeignObjectNotExistsAsync(this.getIdVirtualEnergyTotal(iobrokerObject._id), {
				type: "state",
				common: {
					name: iobrokerObject.common.name	 + ".Virtual_Energy_Total",
					role: "value.power.consumption.virtual",
					type: "number",
					desc: "Created by virtualpowermeter",
					unit: "Wh",
					read: true,
					write: true,
					def : 0
				},
				native: {},
			})

	}

	/**
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} id
	 */
	getIdVirtualEnergyPower(id)
	{
		return id.substr(0, id.lastIndexOf(".") + 1) + "Virtual_Energy_Power";
	}

	/**
	 * gibt die id für Virtual_Energy_Total zurück
	 * @param {string} id
	 */
	getIdVirtualEnergyTotal(id)
	{
		return id.substr(0, id.lastIndexOf(".") + 1) + "Virtual_Energy_Total";
	}


	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.log.info("cleaned everything up...");
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state)
		{
			await this.Energy_Total_rechnenAsync(id);
			await this.Energy_Power_setzenAsync(id);
			await this.Energy_Total_updatetimestamp(id);
			
		}
	
	}

	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.message" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) =>  new Virtualpowermeter(options);
} else {
	// otherwise start the instance directly
 	new Virtualpowermeter();
}

"use strict";
/*
 * Created with @iobroker/create-adapter v1.9.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Time Modules
const cron = require("node-cron"); // Cron Schedulervar
var idgroup = new Object();
var idMulti = new Object();
var groupTotalEnergyData = new Object();
var groupTotalPowerData = new Object();



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



			for (var idobject in idMulti) {
				await this.Energy_Total_rechnenAsync(idobject);
			}
			await this.GruppenGesamtEnergyTotalRechnen();
		});
	}

	
	async GruppeninfoAnpassen()
	{

		for (var group in groupTotalEnergyData)
		{
			var info = "";
			// @ts-ignore
			for (var id in groupTotalEnergyData[group])
			{
				// @ts-ignore
				info += id + ";";

			}
			this.setStateAsync( this.getIdgroupInfo(group),{ val: info, ack: true } );
		}

	}


	async GruppenGesamtEnergyTotalRechnen()
	{
		
		for (var group in groupTotalEnergyData)
		{
			var gesamt = 0;
			// @ts-ignore
			for (var id in groupTotalEnergyData[group])
			{
				// @ts-ignore
				gesamt += groupTotalEnergyData[group][id];

			}
			this.setStateAsync( this.getIdVirtualEnergyTotalgroup(group),{ val: Math.round( gesamt * 100) / 100, ack: true } );
		}

	}

	async GruppenGesamtPowerTotalRechnen()
	{
		
		for (var group in groupTotalPowerData)
		{
			var gesamt = 0;
			// @ts-ignore
			for (var id in groupTotalPowerData[group])
			{
				// @ts-ignore
				gesamt += groupTotalPowerData[group][id];
			}
			this.setStateAsync( this.getIdVirtualEnergyPowergroup(group),{ val: Math.round(gesamt * 100) / 100, ack: true } );
		}

	}


	/**
	 *  hier werden für alle zu überwachenden Elemente: Datenpunkte erstellen, subscribe und Energy_Total_rechnenAsync
	 */
	async initialObjects()
	{
		//Alles unsubsciben so kann man diese funktion immer aufrufen
		await this.unsubscribeStatesAsync("*");
		idMulti = new Object();
		idgroup = new Object();
		groupTotalEnergyData = new Object();
		groupTotalPowerData = new Object();
		// alle Objekte auslesen
		var objects = await this.getForeignObjectsAsync("");
	
		
		for (var idobject in objects) {
			var iobrokerObject = objects[idobject];
			//Überprüfen ob die CustomEinstellung Enabled und MaxPower gesetzt ist
			if (iobrokerObject && iobrokerObject.common &&
				(
					(iobrokerObject.common.custom  && iobrokerObject.common.custom[this.namespace]  && iobrokerObject.common.custom[this.namespace].enabled && !isNaN( iobrokerObject.common.custom[this.namespace].maxpower))
				)) 
			{
				var group = "undefinied"
				if (iobrokerObject.common.custom[this.namespace].group)
				{
					group = iobrokerObject.common.custom[this.namespace].group;
				}
				await this.createVirtualPowerMeterGroupsObjectsAsync(group);	

				// @ts-ignore
				idgroup[iobrokerObject._id] = group;
				if (!(group in  groupTotalEnergyData))
				{
					// @ts-ignore
					groupTotalEnergyData[group] = new Object();

				}
				// @ts-ignore
				groupTotalEnergyData[group][iobrokerObject._id] = 0;

				if (!(group in  groupTotalPowerData))
				{
					// @ts-ignore
					groupTotalPowerData[group] = new Object();

				}
				// @ts-ignore
				groupTotalPowerData[group][iobrokerObject._id] = 0;

				var Multi = 1 * 1;
				//wenn max wert gibt, dann kann dies verwendet werden
				if (iobrokerObject.common.max)
					Multi = Multi / iobrokerObject.common.max;
				// @ts-ignore
				idMulti[iobrokerObject._id] = Multi * iobrokerObject.common.custom[this.namespace].maxpower;

				this.log.info("Erstelle Datenpunkte und Überwache " + iobrokerObject._id);
				await this.createVirtualPowerMeterObjectsAsync(iobrokerObject);	
				await this.subscribeForeignStatesAsync(iobrokerObject._id);
				await this.Energy_Power_setzenAsync(iobrokerObject._id);	
				await this.Energy_Total_rechnenAsync(iobrokerObject._id);
							
				
			}	

		
		}
		
		await this.GruppenGesamtPowerTotalRechnen();	
		await this.GruppenGesamtEnergyTotalRechnen();
		await this.GruppeninfoAnpassen();
	}


	/**
 	* Berechnet anhand des zu überwachenden Object * maxpower die Aktuelle Leistung (Wenn max angegen ist wird value / max genommen)
	* @param {string} id
	 */
	async Energy_Power_setzenAsync(id)	
	{
			//Den State auslesen (z.B. true/false oder 0%,20%,100%)
			var objState = await this.getForeignStateAsync(id)
			if (objState)
			{
							
				// @ts-ignore
				var Multi = idMulti[id]
				var newPower =  objState.val *  Multi;
			
				await this.setForeignStateAsync(this.getIdVirtualEnergyPower(id), { val: newPower, ack: true });
				// @ts-ignore
				groupTotalPowerData[idgroup[id]][id] = newPower;
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
				var newEnergy_Total = Math.round((objEnergyTotal.val + toAddEnergy_Total) * 100)/100;
				if (toAddEnergy_Total > 0)
				{
					//neuen wert setzen
					await this.setForeignStateAsync(idobjEnergyTotal,{ val: newEnergy_Total, ack: true } );
					this.log.info(idobjEnergyTotal + " auf " + newEnergy_Total + " gesetzt (added:" + toAddEnergy_Total + ")");
				}
				// @ts-ignore
				groupTotalEnergyData[idgroup[id]][id] = newEnergy_Total;
			}
		}
	}



	/**
	 * Erstellt zu einer Gruppe die nötigen Objekte
	 * @param {string} group
	 */
	async createVirtualPowerMeterGroupsObjectsAsync(group)
	{
		await this.setObjectNotExists(this.getIdVirtualEnergyPowergroup(group), {
				type: "state",
				common: {
					name: this.getIdVirtualEnergyPowergroup(group),
					role: "value.power.virtual.group",
					type: "number",
					desc: "Created by virtualpowermeter",
					unit: "Watt",
					read: true,
					write: true,
					def : 0
				},
				native: {},
			});

		await this.setObjectNotExists(this.getIdVirtualEnergyTotalgroup(group), {
				type: "state",
				common: {
					name: this.getIdVirtualEnergyTotalgroup(group),
					role: "value.power.consumption.virtual.group",
					type: "number",
					desc: "Created by virtualpowermeter",
					unit: "Wh",
					read: true,
					write: true,
					def : 0
				},
				native: {},
			});

		await this.setObjectNotExists(this.getIdgroupInfo(group), {
			type: "state",
			common: {
				name: this.getIdgroupInfo(group),
				type: "string",
				desc: "Created by virtualpowermeter",
				read: true,
				write: true,
			},
			native: {},
		});

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
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} group
	 */
	getIdVirtualEnergyPowergroup(group)
	{
		return this.namespace + ".group_" + group + ".Virtual_Energy_Power_group_" + group;
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
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} group
	 */
	getIdVirtualEnergyTotalgroup(group)
	{
		return this.namespace + ".group_" + group + ".Virtual_Energy_Total_Gruppe_" + group;
	}
			/**
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} group
	 */
	getIdgroupInfo(group)
	{
		return this.namespace + ".group_" + group + ".info";
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
	async onObjectChange(id, obj) {
		await this.initialObjects()
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
			await this.GruppenGesamtPowerTotalRechnen();
			await this.GruppenGesamtEnergyTotalRechnen();

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

"use strict";
/*
 * Created with @iobroker/create-adapter v1.9.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Time Modules
const cron = require("node-cron"); // Cron Schedulervar
var dic_group_id = new Object();
var dic_Multi_id = new Object();
var dic_TotalEnergy_group_id = new Object();
var dic_Power_group_id = new Object();



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
		this.subscribeForeignObjects("*");
		await this.initialObjects();

		// repeat evey minute the calculation of the totalEnergy
		cron.schedule("* * * * *", async () => {
			this.log.debug("cron started");

			for (var idobject in dic_Multi_id) {
				await this.calc_TotalEnergy(idobject);
			}
			await this.calc_group_TotalEnergy();
		});
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	async onObjectChange(id, obj) {
		var settingsforme = (obj && obj.common && obj.common.custom  && obj.common.custom[this.namespace])
		var oldsettingsexist = (id in dic_Multi_id)

		if (settingsforme || oldsettingsexist)
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
			this.log.info(id + " state changed")
			await this.calc_TotalEnergy(id);
			await this.set_Power_forID(id);
			await this.Energy_Total_updatetimestamp(id);
			await this.calc_group_Power();
			await this.calc_group_TotalEnergy();

		}
	
	}

	/**
	 * create for every enabled object the needed stats and set it to initial it
	 */
	async initialObjects()
	{

		this.log.info("inital all Objects");

		//all unsubscripe to begin completly new
		await this.unsubscribeStatesAsync("*");
		//delete all dics
		dic_Multi_id = new Object();
		dic_group_id = new Object();
		dic_TotalEnergy_group_id = new Object();
		dic_Power_group_id = new Object();
		// read out all Objects
		var objects = await this.getForeignObjectsAsync("");
		for (var idobject in objects) {
			var iobrokerObject = objects[idobject];
			//only do something wen enabled and MaxPowerset
			if (iobrokerObject && iobrokerObject.common &&
				(
					(iobrokerObject.common.custom  && iobrokerObject.common.custom[this.namespace]  && iobrokerObject.common.custom[this.namespace].enabled && !isNaN( iobrokerObject.common.custom[this.namespace].maxpower))
				)) 
			{
				this.log.info("initial (enabled and maxPower OK): " + iobrokerObject._id );

				var group = "undefinied"
				if (iobrokerObject.common.custom[this.namespace].group)
				{
					group = iobrokerObject.common.custom[this.namespace].group;
				}
				await this.create_object_for_group(group);	

				//dic_group for the id set
				// @ts-ignore
				dic_group_id[iobrokerObject._id] = group;


				//needed for group calculations
				if (!(group in  dic_TotalEnergy_group_id))
				{
					// @ts-ignore
					dic_TotalEnergy_group_id[group] = new Object();

				}
				// @ts-ignore
				dic_TotalEnergy_group_id[group][iobrokerObject._id] = 0;

				//needed for group calculations
				if (!(group in  dic_Power_group_id))
				{
					// @ts-ignore
					dic_Power_group_id[group] = new Object();
				}
				// @ts-ignore
				dic_Power_group_id[group][iobrokerObject._id] = 0;
				
				//calculate the Muliplikator for the state (Dimmer 60W: Multi 0.6, State 60W: Multi 60)
				var Multi = 1;
				//wenn max wert gibt, dann kann dies verwendet werden
				if (iobrokerObject.common.max)
					Multi = Multi / iobrokerObject.common.max;
				// @ts-ignore
				dic_Multi_id[iobrokerObject._id] = Multi * iobrokerObject.common.custom[this.namespace].maxpower;

				await this.create_objects_for_id(iobrokerObject);	
				this.log.debug("subscribeForeignStates " + iobrokerObject._id);
				await this.subscribeForeignStatesAsync(iobrokerObject._id);
				await this.set_Power_forID(iobrokerObject._id);	
				await this.calc_TotalEnergy(iobrokerObject._id);
				this.log.debug("initial done " + iobrokerObject._id);
			}	
		}
		await this.calc_group_Power();	
		await this.calc_group_TotalEnergy();
		await this.set_group_info();
		this.log.info("initial completed");
	}

	/**
 	* Berechnet anhand des zu überwachenden Object * maxpower die Aktuelle Leistung (Wenn max angegen ist wird value / max genommen)
	* @param {string} id
	 */
	async set_Power_forID(id)	
	{
		var newPower =  0;
		//Den State auslesen (z.B. true/false oder 0%,20%,100%)
		var objState = await this.getForeignStateAsync(id)
		if (objState)
		{
			// @ts-ignore
			var Multi = dic_Multi_id[id]
			newPower =  objState.val *  Multi;
		
		}
		this.log.debug( id + " set "  + newPower);
		await this.setForeignStateAsync(this.getID_Power(id), { val: newPower, ack: true });

		//needed for groupCalculation
		// @ts-ignore
		dic_Power_group_id[dic_group_id[id]][id] = newPower;
	}

	/**
 	* Den Timestamp von Energy_Total auf jetzt setzen (für berechnung notwendig)
	* @param {string} id
 	*/
 	async Energy_Total_updatetimestamp(id) {
		this.log.debug( id + " update timestamp");
		await	this.setForeignStateAsync(this.getID_EnergyTotal(id),{ ts: new Date().getTime(), ack:true } );
	}


	/**
 	* calc the Total Energy size the last Change and add it
	* @param {string} id
 	*/
 	async calc_TotalEnergy(id) {
		//Die Aktuelle Power auslesen
		var objEnergyPower = await this.getForeignStateAsync(this.getID_Power(id));
		if (objEnergyPower)	{
			var idobjEnergyTotal = this.getID_EnergyTotal(id);
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
					this.log.debug(idobjEnergyTotal + " set " + newEnergy_Total + " (added:" + toAddEnergy_Total + ")");
					await this.setForeignStateAsync(idobjEnergyTotal,{ val: newEnergy_Total, ack: true } );
				}
				//needed for groupCalculation
				// @ts-ignore
				dic_TotalEnergy_group_id[dic_group_id[id]][id] = newEnergy_Total;
			}
		}
	}



	
	/**
	 * create Datapoints needed for a datapoint
	 * @param {ioBroker.Object} iobrokerObject
	 */
	async create_objects_for_id(iobrokerObject)
	{
		this.log.debug("create Datapoints for group " + iobrokerObject + " if not exists" );

		this.log.debug("create " + this.getID_Power(iobrokerObject._id) + " if not exists" );
		await this.setForeignObjectNotExistsAsync(this.getID_Power(iobrokerObject._id), {
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

		this.log.debug("create " + this.getID_EnergyTotal(iobrokerObject._id) + " if not exists" );
		await this.setForeignObjectNotExistsAsync(this.getID_EnergyTotal(iobrokerObject._id), {
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
	 * create Datapoints needed for group
	 * @param {string} group
	 */
	async create_object_for_group(group)
	{
		this.log.debug("create Datapoints for group " + group + " if not exists" );

		this.log.debug("create " + this.getID_group_Power(group) + " if not exists" );
		await this.setObjectNotExists(this.getID_group_Power(group), {
				type: "state",
				common: {
					name: this.getID_group_Power(group),
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

		this.log.debug("create " + this.getID_group_TotalEnergy(group) + " if not exists" );
		await this.setObjectNotExists(this.getID_group_TotalEnergy(group), {
				type: "state",
				common: {
					name: this.getID_group_TotalEnergy(group),
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

		this.log.debug("create " + this.getIdgroupInfo(group) + " if not exists" );
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
	 * set the groupinfo per group with the watched ids
	 */
	async set_group_info()
	{
		for (var group in dic_TotalEnergy_group_id)
		{
			var info = "";
			// @ts-ignore
			for (var id in dic_TotalEnergy_group_id[group])
			{
				// @ts-ignore
				info += id + ";";
			}
			this.log.debug("setze " + this.getIdgroupInfo(group) + " auf : " + info);
			this.setStateAsync( this.getIdgroupInfo(group),{ val: info, ack: true } );
		}
	}

	/**
	 * Add all TotalEnergy per group and set the State per group
	 */
	async calc_group_TotalEnergy()
	{
		
		for (var group in dic_TotalEnergy_group_id)
		{
			var gesamt = 0;
			// @ts-ignore
			for (var id in dic_TotalEnergy_group_id[group])
			{
				// @ts-ignore
				gesamt += dic_TotalEnergy_group_id[group][id];
			}
			gesamt = Math.round( gesamt * 100) / 100;
			this.log.debug("setze " + this.getID_group_TotalEnergy(group) + " auf : " + gesamt);
			this.setStateAsync( this.getID_group_TotalEnergy(group),{ val: gesamt, ack: true } );
		}
	}

	/**
	 * Add all Power per group and set the State per group
	 */async calc_group_Power()
	{
		for (var group in dic_Power_group_id)
		{
			var sum = 0;
			// @ts-ignore
			for (var id in dic_Power_group_id[group])
			{
				// @ts-ignore
				sum += dic_Power_group_id[group][id];
			}
			this.log.debug("setze " + this.getID_group_Power(group) + " auf : " + sum);
			this.setStateAsync( this.getID_group_Power(group),{ val: Math.round(sum * 100) / 100, ack: true } );
		}
	}

	/**
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} id
	 */
	getID_Power(id)
	{
		return id.substr(0, id.lastIndexOf(".") + 1) + "Virtual_Energy_Power";
	}

	/**
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} group
	 */
	getID_group_Power(group)
	{
		return this.namespace + ".group_" + group + ".Virtual_Energy_Power_group_" + group;
	}

	/**
	 * gibt die id für Virtual_Energy_Total zurück
	 * @param {string} id
	 */
	getID_EnergyTotal(id)
	{
		return id.substr(0, id.lastIndexOf(".") + 1) + "Virtual_Energy_Total";
	}

	/**
	 * Gibt die ID für Virtual_Energy_Power zurück
	 * @param {string} group
	 */
	getID_group_TotalEnergy(group)
	{
		return this.namespace + ".group_" + group + ".Virtual_Energy_Total_group_" + group;
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

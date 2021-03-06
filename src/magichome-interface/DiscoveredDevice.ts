import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

export class DiscoveredDevice {

  constructor(  
       public ipAddress, 
       public uniqueId, 
       public modelNumber,
  ){}

  public readonly log: Logger;
  public readonly config: PlatformConfig;

  isAllowed(){

    let isAllowed = true;
    try {

      if(this.config.deviceManagement.blacklistedUniqueIDs !== undefined 
        && this.config.deviceManagement.blacklistOrWhitelist !== undefined){

        if (((this.config.deviceManagement.blacklistedUniqueIDs).includes(this.uniqueId) && (this.config.deviceManagement.blacklistOrWhitelist).includes('blacklist')) 
   || (!(this.config.deviceManagement.blacklistedUniqueIDs).includes(this.uniqueId)) && (this.config.deviceManagement.blacklistOrWhitelist).includes('whitelist')){
          isAllowed = false; 
        }
      }
    } catch (error) {
      this.log.debug(error);
    }

    return isAllowed;
  }
    
}
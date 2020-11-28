/*
    This are common function that one or more accessory might implement

*/
import { ILightState, opMode } from '../magichome-interface/types';
import { convertRGBtoHSL, convertHSLtoRGB, convertWhitesToColorTemperature, clamp } from '../magichome-interface/utils';

export default class CommonClass{

  /* 
    converts HSB to RGBWW
    Homekit uses HSB, MagicHome uses RGB
  */
  static convertHSBtoRGBWW(state:ILightState, that ):ILightState{
    const { colorWhiteThreshold } = that.config;
    //**** local variables ****\\
    const hsl = state.HSL;
    const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const whites = CommonClass.hueToWhiteTemperature(state); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = state.brightness;
    
    // this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    // this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
    let mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = Math.round(((clamp(whites.warmWhite, 0, 255) / 100) * brightness));
    let cw = Math.round(((clamp(whites.coldWhite, 0, 255) / 100) * brightness));
    

    if (hsl.hue == 31 && (hsl.saturation == 33)) {
      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
      cw = 0;
      mask = 0x0F;
      //this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
    } else if ((hsl.hue == 208 && (hsl.saturation == 17))) {
      r = 0;
      g = 0;
      b = 0;
      ww = 0;
      cw = Math.round((255 / 100) * brightness);
      mask = 0x0F;
      // this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);

      //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
      //White colors were already calculated above
    } else if ((hsl.saturation < colorWhiteThreshold)) {
      r = 0;
      g = 0;
      b = 0;
      mask = 0x0F;
      // this.platform.log.debug('Setting warmWhite and coldWhite without colors: ww:%o cw:%o', ww, cw);
    } else { //else set warmWhite and coldWhite to zero. Color mask already set at top

      ww = 0;
      cw = 0;
      //this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);

    }
    state.RGB = { red:r, green:g, blue: b};
    state.whiteValues= { coldWhite:cw, warmWhite:ww};
    state.operatingMode = CommonClass.parseOperatingMode(mask);

    return state;
  }

  /*
        Update H,S,B based on RBGWW
  */
  static convertRGBWWtoHSB(state:ILightState, that ):ILightState{
    state.HSL = convertRGBtoHSL(state.RGB);
    const { mired } = convertWhitesToColorTemperature(state.whiteValues);
    state.colorTemperature = mired;
    const {hue: _hue, saturation: _saturation, brightness:_brightness} = this.estimateBrightness(state, {});
    state.brightness = _brightness;
    state.HSL.hue = _hue;
    state.HSL.saturation = _saturation;
    return state;
  }   

  static estimateBrightness(lightState:ILightState, props:any):any {
    const { colorWhiteThreshold } = props;
    let { hue, saturation } = lightState.HSL;
    const { luminance } = lightState.HSL;
    let brightness = 0;
    const { isOn } = lightState;
    const { coldWhite, warmWhite } = lightState.whiteValues;

    if(luminance > 0 && isOn){
      brightness = luminance * 2;
    } else if (isOn){
      brightness = clamp(((coldWhite/2.55) + (warmWhite/2.55)), 0, 100);
      if(warmWhite>coldWhite){
        saturation = colorWhiteThreshold - (colorWhiteThreshold * (coldWhite/255));
        hue = 0.0;
      } else {
        saturation = colorWhiteThreshold - (colorWhiteThreshold * (warmWhite/255));
        hue = 180.0;
      }
    }
    brightness = Math.round(brightness);
    return { hue, saturation, brightness};
  }

  /**
   ** @calculateWhiteColor
   *  determine warmWhite/coldWhite values from hue
   *  the closer to 0/360 the weaker coldWhite brightness becomes
   *  the closer to 180 the weaker warmWhite brightness becomes
   *  the closer to 90/270 the stronger both warmWhite and coldWhite become simultaniously
   */
  static hueToWhiteTemperature(lightState:ILightState) {
    const hsl = lightState.HSL;
    let multiplier = 0;
    const whiteTemperature = { warmWhite: 0, coldWhite: 0 };


    if (hsl.hue <= 90) {        //if hue is <= 90, warmWhite value is full and we determine the coldWhite value based on Hue
      whiteTemperature.warmWhite = 255;
      multiplier = ((hsl.hue / 90));
      whiteTemperature.coldWhite = Math.round((255 * multiplier));
    } else if (hsl.hue > 270) { //if hue is >270, warmWhite value is full and we determine the coldWhite value based on Hue
      whiteTemperature.warmWhite = 255;
      multiplier = (1 - (hsl.hue - 270) / 90);
      whiteTemperature.coldWhite = Math.round((255 * multiplier));
    } else if (hsl.hue > 180 && hsl.hue <= 270) { //if hue is > 180 and <= 270, coldWhite value is full and we determine the warmWhite value based on Hue
      whiteTemperature.coldWhite = 255;
      multiplier = ((hsl.hue - 180) / 90);
      whiteTemperature.warmWhite = Math.round((255 * multiplier));
    } else if (hsl.hue > 90 && hsl.hue <= 180) {//if hue is > 90 and <= 180, coldWhite value is full and we determine the warmWhite value based on Hue
      whiteTemperature.coldWhite = 255;
      multiplier = (1 - (hsl.hue - 90) / 90);
      whiteTemperature.warmWhite = Math.round((255 * multiplier));
    }
    return whiteTemperature;
  }

  
  static parseOperatingMode(opModeCode): opMode{
    if(opModeCode === 0xF0){
      return opMode.redBlueGreenMode;
    } else if( opModeCode === 0x0F){
      return opMode.temperatureMode;
    } else if ( opModeCode === 0xFF){
      return opMode.simultaneous;
    } else {
      return opMode.unknown;
    }
  }
  
  static getMaskFromOpMode(opModeCode:opMode):number{
    if(opModeCode === opMode.redBlueGreenMode){
      return 0xF0;
    } else if( opModeCode === opMode.temperatureMode ){
      return 0x0F;
    } else if ( opModeCode === opMode.simultaneous ){
      return 0xFF;
    } else {
      return 0xFF;
    }
  }
}



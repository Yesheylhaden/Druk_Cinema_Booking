import {notificationsReady,notify} from '../../common/http.js';
export const emailEnabled=notificationsReady;
export const sendPaymentOtp=(to,code,total)=>notify({to,subject:'Druk Cinema DEMO payment code',text:'Your demo checkout code is '+code+'. It expires in 5 minutes. Simulated total: Nu. '+total+'. No money is charged. This is not a Bank of Bhutan OTP. Enter it only on your Druk Cinema demo checkout.'});

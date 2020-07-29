import KeyboardSVG from '../../svg/skin-light/ic_keyboard_678_48dp.svg';
import MoreSVG from '../../svg/skin-light/ic_more_horiz_678_48dp.svg';
import CameraSVG from '../../svg/skin-light/ic_photo_camera_678_48dp.svg';
import PowerSVG from '../../svg/skin-light/ic_power_settings_new_678_48px.svg';
import VolumeDownSVG from '../../svg/skin-light/ic_volume_down_678_48px.svg';
import VolumeUpSVG from '../../svg/skin-light/ic_volume_up_678_48px.svg';
import BackSVG from '../../svg/skin-light/System_Back_678.svg';
import HomeSVG from '../../svg/skin-light/System_Home_678.svg';
import OverviewSVG from '../../svg/skin-light/System_Overview_678.svg';

enum Icon {
    BACK,
    HOME,
    OVERVIEW,
    POWER,
    VOLUME_UP,
    VOLUME_DOWN,
    MORE,
    CAMERA,
    KEYBOARD
}

export default class SvgImage {
    static Icon = Icon;
    private static getSvgString(type: Icon): string {
        switch (type) {
            case Icon.KEYBOARD:
                return KeyboardSVG;
            case Icon.MORE:
                return MoreSVG;
            case Icon.CAMERA:
                return CameraSVG;
            case Icon.POWER:
                return PowerSVG;
            case Icon.VOLUME_DOWN:
                return VolumeDownSVG;
            case Icon.VOLUME_UP:
                return VolumeUpSVG;
            case Icon.BACK:
                return BackSVG;
            case Icon.HOME:
                return HomeSVG;
            case Icon.OVERVIEW:
                return OverviewSVG;
            default:
                return '';
        }
    }
    public static create(type: Icon): Element {
        const dummy = document.createElement('div');
        dummy.innerHTML = this.getSvgString(type);
        return dummy.children[0];
    }
}

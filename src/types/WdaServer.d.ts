// This file is used instead of 'appium-xcuitest-driver/lib/server'

import * as http from 'http';
import { XCUITestDriver } from 'appium-xcuitest-driver';

declare class Server extends http.Server {
    driver: XCUITestDriver;
}

export { Server, XCUITestDriver };

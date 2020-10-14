import Command from '../../command';
import Bluebird from 'bluebird';
import { Features } from '../../../Features';
declare class GetFeaturesCommand extends Command<Features> {
    execute(): Bluebird<Features>;
    private _parseFeatures;
}
export = GetFeaturesCommand;

import { SLOT_HTML } from '~/constants';
import { fragment } from './fragment';
import { firstChild } from './node';


export default firstChild.call( fragment(SLOT_HTML) );
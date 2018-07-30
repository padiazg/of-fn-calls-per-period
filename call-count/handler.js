"use strict"

const moment = require("moment-timezone");
const request = require("request-promise-native");
const AsciiTable = require('ascii-table');

const prometheusUrl = process.env.prometheus || 'http://prometheus:9090';
// const prometheusUrl = 'http://10.22.1.80:9090';
const uri = `${prometheusUrl}/api/v1/query_range`;

const outputTable = data => {
    let text = '';
    for (const {metric, values} of data.result) {
        const table = new AsciiTable('Functions');

        table.fromJSON({
            heading: ['','Day/Hour', 'Accum. Calls', 'Calls'],
            rows: values.map((v,i,x) => {
                return [
                    i+1,    // index
                    moment(v[0], 'X').format("YYYY-MM-DD HH:MM"),   // Day/Hour
                    v[1],                                           // Accummulated calls
                    i>0 ? parseInt(v[1])-parseInt(x[i-1][1]) : ''   // Calls in this step
                ] // return ...
            }) // rows: ...
        }); // fromJSON ...

        const sum = parseInt(values[values.length-1][1]) - parseInt(values[0][1]);
        text += `\n${metric.function_name}/${metric.code} sum=${sum}\n${table.toString()}`
    } // for ...
    return text;
} // outputTable ...

module.exports = (context, callback) => {

    // always receive params as a json object
    let incomming;
    try { incomming = JSON.parse(context) }
    catch(e) { callback(e, undefined); return; }

    let format =  incomming.format ? incomming.format.toLowerCase() : 'table';
    format = /^(table|json)$/i.test(format) ? format : 'table';

    const qs = {
        query: 'gateway_function_invocation_total',
        start: moment(incomming.start, "YYYY-MM-DD").format(),
        end: moment(incomming.end, "YYYY-MM-DD").format(),
        step: incomming.step || '1h'
    }

    request({ uri, qs})
    .then(result => {
        const { data } = JSON.parse(result);

        if (!data.result.length) {
            callback(undefined, [] );
            return;
        }

        if (format == 'table') {
            const table = outputTable(data);
            callback(undefined, table );
        }

        if (format == 'json') {
            callback(undefined, data.result);
        }
    })
    .catch(e => { callback(e, undefined); })
    ;
}

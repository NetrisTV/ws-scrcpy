import { Express } from 'express';
import Stats from '@devicefarmer/adbkit/lib/adb/sync/stats';
import { AdbUtils } from '../goog-device/AdbUtils';
import path from 'path';

export class FileListing {
    private static async buildDirContent(serial: string, dir: string): Promise<string> {
        const list = await AdbUtils.readdir(serial, dir);
        let parent = '';
        if (!dir.endsWith('/')) {
            dir += '/';
        }
        if (dir !== '/') {
            let parentLink = path.join(`/fs/${serial}`, dir, '..');
            if (!parentLink.endsWith('/')) {
                parentLink = parentLink + '/';
            }
            parent = `<a class="icon up" href="${parentLink}">[parent]</a>\n    `;
        }
        return (
            `<head><title>Content of ${dir}</title><style>
a.icon {
    -webkit-padding-start: 1.5em;
    -moz-padding-start: 1.5em;
    text-decoration: none;
    user-select: auto;
}

a.icon:hover {
    text-decoration: underline;
}

a.file {
    background : url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAABnRSTlMAAAAAAABupgeRAAABHUlEQVR42o2RMW7DIBiF3498iHRJD5JKHurL+CRVBp+i2T16tTynF2gO0KSb5ZrBBl4HHDBuK/WXACH4eO9/CAAAbdvijzLGNE1TVZXfZuHg6XCAQESAZXbOKaXO57eiKG6ft9PrKQIkCQqFoIiQFBGlFIB5nvM8t9aOX2Nd18oDzjnPgCDpn/BH4zh2XZdlWVmWiUK4IgCBoFMUz9eP6zRN75cLgEQhcmTQIbl72O0f9865qLAAsURAAgKBJKEtgLXWvyjLuFsThCSstb8rBCaAQhDYWgIZ7myM+TUBjDHrHlZcbMYYk34cN0YSLcgS+wL0fe9TXDMbY33fR2AYBvyQ8L0Gk8MwREBrTfKe4TpTzwhArXWi8HI84h/1DfwI5mhxJamFAAAAAElFTkSuQmCC ") left top no-repeat;
}

a.dir {
    background : url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAd5JREFUeNqMU79rFUEQ/vbuodFEEkzAImBpkUabFP4ldpaJhZXYm/RiZWsv/hkWFglBUyTIgyAIIfgIRjHv3r39MePM7N3LcbxAFvZ2b2bn22/mm3XMjF+HL3YW7q28YSIw8mBKoBihhhgCsoORot9d3/ywg3YowMXwNde/PzGnk2vn6PitrT+/PGeNaecg4+qNY3D43vy16A5wDDd4Aqg/ngmrjl/GoN0U5V1QquHQG3q+TPDVhVwyBffcmQGJmSVfyZk7R3SngI4JKfwDJ2+05zIg8gbiereTZRHhJ5KCMOwDFLjhoBTn2g0ghagfKeIYJDPFyibJVBtTREwq60SpYvh5++PpwatHsxSm9QRLSQpEVSd7/TYJUb49TX7gztpjjEffnoVw66+Ytovs14Yp7HaKmUXeX9rKUoMoLNW3srqI5fWn8JejrVkK0QcrkFLOgS39yoKUQe292WJ1guUHG8K2o8K00oO1BTvXoW4yasclUTgZYJY9aFNfAThX5CZRmczAV52oAPoupHhWRIUUAOoyUIlYVaAa/VbLbyiZUiyFbjQFNwiZQSGl4IDy9sO5Wrty0QLKhdZPxmgGcDo8ejn+c/6eiK9poz15Kw7Dr/vN/z6W7q++091/AQYA5mZ8GYJ9K0AAAAAASUVORK5CYII= ") left top no-repeat;
}

a.up {
    background : url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAmlJREFUeNpsU0toU0EUPfPysx/tTxuDH9SCWhUDooIbd7oRUUTMouqi2iIoCO6lceHWhegy4EJFinWjrlQUpVm0IIoFpVDEIthm0dpikpf3ZuZ6Z94nrXhhMjM3c8895977BBHB2PznK8WPtDgyWH5q77cPH8PpdXuhpQT4ifR9u5sfJb1bmw6VivahATDrxcRZ2njfoaMv+2j7mLDn93MPiNRMvGbL18L9IpF8h9/TN+EYkMffSiOXJ5+hkD+PdqcLpICWHOHc2CC+LEyA/K+cKQMnlQHJX8wqYG3MAJy88Wa4OLDvEqAEOpJd0LxHIMdHBziowSwVlF8D6QaicK01krw/JynwcKoEwZczewroTvZirlKJs5CqQ5CG8pb57FnJUA0LYCXMX5fibd+p8LWDDemcPZbzQyjvH+Ki1TlIciElA7ghwLKV4kRZstt2sANWRjYTAGzuP2hXZFpJ/GsxgGJ0ox1aoFWsDXyyxqCs26+ydmagFN/rRjymJ1898bzGzmQE0HCZpmk5A0RFIv8Pn0WYPsiu6t/Rsj6PauVTwffTSzGAGZhUG2F06hEc9ibS7OPMNp6ErYFlKavo7MkhmTqCxZ/jwzGA9Hx82H2BZSw1NTN9Gx8ycHkajU/7M+jInsDC7DiaEmo1bNl1AMr9ASFgqVu9MCTIzoGUimXVAnnaN0PdBBDCCYbEtMk6wkpQwIG0sn0PQIUF4GsTwLSIFKNqF6DVrQq+IWVrQDxAYQC/1SsYOI4pOxKZrfifiUSbDUisif7XlpGIPufXd/uvdvZm760M0no1FZcnrzUdjw7au3vu/BVgAFLXeuTxhTXVAAAAAElFTkSuQmCC ") left top no-repeat;
}
</style>
<script>
    function addRow(name, href, type, size, mtime) {
        var row = document.createElement('tr');
        var nameTd = document.createElement('td');
        var link = document.createElement('a');
        link.classList.add('icon', type);
        link.href = href;
        link.innerText = name;
        nameTd.appendChild(link);
        row.appendChild(nameTd);
        var sizeTd = document.createElement('td');
        sizeTd.innerText = size;
        row.appendChild(sizeTd);
        var mtimeTd = document.createElement('td');
        mtimeTd.innerText = new Date(mtime).toLocaleString();
        row.appendChild(mtimeTd);
        window.tbody.appendChild(row);
    }
    window.onload = function() {
        var prefix = '/fs/${serial}';
        var dir = ${JSON.stringify(dir)};
        ${JSON.stringify(list)}
        .forEach(function(stat) {
            var href = prefix + dir + stat.name;
            var type = 'file'
            if (stat.isDir === 1) {
                if (!href.endsWith('/')) {
                    href += '/';
                }
                type = 'dir';
            }
            addRow(stat.name, href, type, stat.size, stat.dateModified);
       })` +
            /* list
                .map((stat) => {
                    let href = path.join(`/fs/${serial}/`, dir, stat.name);
                    const isDir = stat.isDir === 1;
                    if (isDir) {
                        if (!href.endsWith('/')) {
                            href += '/';
                        }
                    }
                    return `        addRow(${JSON.stringify(stat.name)}, '${href.toString()}', ${isDir}, ${
                        stat.size
                    }, ${stat.dateModified});`;
                })
                .join('\n') +*/
            `
    }
</script>
</head>
<body>
    ${parent}<table>
        <thead><tr><td>Name</td><td>Size</td><td>MTime</td></tr></thead>
        <tbody id="tbody">
        </tbody>
    </table>
</body>`
        );
    }
    public static addRouteHandlers(app: Express): void {
        app.get('/fs/:serial*', async (req, res) => {
            const { serial } = req.params;
            const pathString = req.params[0] || '/';
            let stats: Stats;
            try {
                stats = await AdbUtils.stats(serial, pathString);
            } catch (e) {
                res.sendStatus(500);
                res.send(e);
                return;
            }
            if (stats.isDirectory()) {
                try {
                    res.send(await this.buildDirContent(serial, pathString));
                } catch (e) {
                    res.status(500);
                    res.send(e.message);
                }
            } else {
                const transfer = await AdbUtils.pipePullFile(serial, pathString);
                res.setHeader('content-type', 'application/octet-stream');
                transfer.on('error', (e) => {
                    console.log('on error', e.message);
                    res.status(500);
                    res.send(e.message);
                });
                transfer.pipe(res);
            }
        });
    }
}

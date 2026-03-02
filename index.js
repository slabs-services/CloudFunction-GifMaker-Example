import { spawn } from 'child_process';
import { config } from 'dotenv';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { GetObject, PutObject } from "@spacelabs-cloud/cosmic";

config();

async function downloadVideo(urn) {
  const readStream = await GetObject(urn);

  await pipeline(
    readStream.data,
    fs.createWriteStream("video.mp4")
  );
}

function spawnFFmpeg(args, label) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args);

        proc.stderr.on('data', d => console.error(d.toString()));
        proc.stdout.on('data', d => console.log(d.toString()));

        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`${label} exited with code ${code}`));
        });

        proc.on('error', reject);
    });
}

async function uploadGif(lakeName, gifName) {
    const res = await PutObject(lakeName, fs.createReadStream(gifName), gifName);

    console.log('Upload result:', res);
}

async function main() {
    await downloadVideo(process.env.VIDEO_URN);

    const gifName = 'output.gif';

    await spawnFFmpeg([
        '-ss', '00:15:00',
        '-t', '15',
        '-i', 'video.mp4',
        '-vf', 'fps=12,scale=1280:-1:flags=lanczos,palettegen',
        'palette.png'
    ], 'palette');

    await spawnFFmpeg([
        '-ss', '00:15:00',
        '-t', '15',
        '-i', 'video.mp4',
        '-i', 'palette.png',
        '-filter_complex',
        'fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse',
        gifName
    ], 'gif');

    await uploadGif(process.env.DESTINATION_LAKE, gifName);

    console.log('GIF generated successfully');
}

main().catch(err => console.error(err));
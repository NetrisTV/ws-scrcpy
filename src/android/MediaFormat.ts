export default class MediaFormat {
    public static readonly MIMETYPE_VIDEO_VP8: string = 'video/x-vnd.on2.vp8';
    public static readonly MIMETYPE_VIDEO_VP9: string = 'video/x-vnd.on2.vp9';
    public static readonly MIMETYPE_VIDEO_AV1: string = 'video/av01';
    public static readonly MIMETYPE_VIDEO_AVC: string = 'video/avc';
    public static readonly MIMETYPE_VIDEO_HEVC: string = 'video/hevc';
    public static readonly MIMETYPE_VIDEO_MPEG4: string = 'video/mp4v-es';
    public static readonly MIMETYPE_VIDEO_H263: string = 'video/3gpp';
    public static readonly MIMETYPE_VIDEO_MPEG2: string = 'video/mpeg2';
    public static readonly MIMETYPE_VIDEO_RAW: string = 'video/raw';
    public static readonly MIMETYPE_VIDEO_DOLBY_VISION: string = 'video/dolby-vision';
    public static readonly MIMETYPE_VIDEO_SCRAMBLED: string = 'video/scrambled';

    public static readonly MIMETYPE_AUDIO_AMR_NB: string = 'audio/3gpp';
    public static readonly MIMETYPE_AUDIO_AMR_WB: string = 'audio/amr-wb';
    public static readonly MIMETYPE_AUDIO_MPEG: string = 'audio/mpeg';
    public static readonly MIMETYPE_AUDIO_AAC: string = 'audio/mp4a-latm';
    public static readonly MIMETYPE_AUDIO_QCELP: string = 'audio/qcelp';
    public static readonly MIMETYPE_AUDIO_VORBIS: string = 'audio/vorbis';
    public static readonly MIMETYPE_AUDIO_OPUS: string = 'audio/opus';
    public static readonly MIMETYPE_AUDIO_G711_ALAW: string = 'audio/g711-alaw';
    public static readonly MIMETYPE_AUDIO_G711_MLAW: string = 'audio/g711-mlaw';
    public static readonly MIMETYPE_AUDIO_RAW: string = 'audio/raw';
    public static readonly MIMETYPE_AUDIO_FLAC: string = 'audio/flac';
    public static readonly MIMETYPE_AUDIO_MSGSM: string = 'audio/gsm';
    public static readonly MIMETYPE_AUDIO_AC3: string = 'audio/ac3';
    public static readonly MIMETYPE_AUDIO_EAC3: string = 'audio/eac3';
    public static readonly MIMETYPE_AUDIO_EAC3_JOC: string = 'audio/eac3-joc';
    public static readonly MIMETYPE_AUDIO_AC4: string = 'audio/ac4';
    public static readonly MIMETYPE_AUDIO_SCRAMBLED: string = 'audio/scrambled';

    /**
     * MIME type for HEIF still image data encoded in HEVC.
     *
     * To decode such an image, {@link MediaCodec} decoder for
     * {@link #MIMETYPE_VIDEO_HEVC} shall be used. The client needs to form
     * the correct {@link #MediaFormat} based on additional information in
     * the track format, and send it to {@link MediaCodec#configure}.
     *
     * The track's MediaFormat will come with {@link #KEY_WIDTH} and
     * {@link #KEY_HEIGHT} keys, which describes the width and height
     * of the image. If the image doesn't contain grid (i.e. none of
     * {@link #KEY_TILE_WIDTH}, {@link #KEY_TILE_HEIGHT},
     * {@link #KEY_GRID_ROWS}, {@link #KEY_GRID_COLUMNS} are present}), the
     * track will contain a single sample of coded data for the entire image,
     * and the image width and height should be used to set up the decoder.
     *
     * If the image does come with grid, each sample from the track will
     * contain one tile in the grid, of which the size is described by
     * {@link #KEY_TILE_WIDTH} and {@link #KEY_TILE_HEIGHT}. This size
     * (instead of {@link #KEY_WIDTH} and {@link #KEY_HEIGHT}) should be
     * used to set up the decoder. The track contains {@link #KEY_GRID_ROWS}
     * by {@link #KEY_GRID_COLUMNS} samples in row-major, top-row first,
     * left-to-right order. The output image should be reconstructed by
     * first tiling the decoding results of the tiles in the correct order,
     * then trimming (before rotation is applied) on the bottom and right
     * side, if the tiled area is larger than the image width and height.
     */
    public static readonly MIMETYPE_IMAGE_ANDROID_HEIC: string = 'image/vnd.android.heic';

    /**
     * MIME type for WebVTT subtitle data.
     */
    public static readonly MIMETYPE_TEXT_VTT: string = 'text/vtt';

    /**
     * MIME type for SubRip (SRT) container.
     */
    public static readonly MIMETYPE_TEXT_SUBRIP: string = 'application/x-subrip';

    /**
     * MIME type for CEA-608 closed caption data.
     */
    public static readonly MIMETYPE_TEXT_CEA_608: string = 'text/cea-608';

    /**
     * MIME type for CEA-708 closed caption data.
     */
    public static readonly MIMETYPE_TEXT_CEA_708: string = 'text/cea-708';

    // private mMap: Map<String, Object> = new Map();

    /**
     * A key describing the mime type of the MediaFormat.
     * The associated value is a string.
     */
    public static readonly KEY_MIME: string = 'mime';

    /**
     * A key describing the language of the content, using either ISO 639-1
     * or 639-2/T codes.  The associated value is a string.
     */
    public static readonly KEY_LANGUAGE: string = 'language';

    /**
     * A key describing the sample rate of an audio format.
     * The associated value is an integer
     */
    public static readonly KEY_SAMPLE_RATE: string = 'sample-rate';

    /**
     * A key describing the number of channels in an audio format.
     * The associated value is an integer
     */
    public static readonly KEY_CHANNEL_COUNT: string = 'channel-count';

    /**
     * A key describing the width of the content in a video format.
     * The associated value is an integer
     */
    public static readonly KEY_WIDTH: string = 'width';

    /**
     * A key describing the height of the content in a video format.
     * The associated value is an integer
     */
    public static readonly KEY_HEIGHT: string = 'height';

    /**
     * A key describing the maximum expected width of the content in a video
     * decoder format, in case there are resolution changes in the video content.
     * The associated value is an integer
     */
    public static readonly KEY_MAX_WIDTH: string = 'max-width';

    /**
     * A key describing the maximum expected height of the content in a video
     * decoder format, in case there are resolution changes in the video content.
     * The associated value is an integer
     */
    public static readonly KEY_MAX_HEIGHT: string = 'max-height';

    /** A key describing the maximum size in bytes of a buffer of data
     * described by this MediaFormat.
     * The associated value is an integer
     */
    public static readonly KEY_MAX_INPUT_SIZE: string = 'max-input-size';

    /**
     * A key describing the average bitrate in bits/sec.
     * The associated value is an integer
     */
    public static readonly KEY_BIT_RATE: string = 'bitrate';

    /**
     * A key describing the max bitrate in bits/sec.
     * This is usually over a one-second sliding window (e.g. over any window of one second).
     * The associated value is an integer
     * @hide
     */
    public static readonly KEY_MAX_BIT_RATE: string = 'max-bitrate';

    /**
     * A key describing the color format of the content in a video format.
     * Constants are declared in {@link android.media.MediaCodecInfo.CodecCapabilities}.
     */
    public static readonly KEY_COLOR_FORMAT: string = 'color-format';

    /**
     * A key describing the frame rate of a video format in frames/sec.
     * The associated value is normally an integer when the value is used by the platform,
     * but video codecs also accept float configuration values.
     * Specifically, {@link MediaExtractor#getTrackFormat MediaExtractor} provides an integer
     * value corresponding to the frame rate information of the track if specified and non-zero.
     * Otherwise, this key is not present. {@link MediaCodec#configure MediaCodec} accepts both
     * float and integer values. This represents the desired operating frame rate if the
     * {@link #KEY_OPERATING_RATE} is not present and {@link #KEY_PRIORITY} is {@code 0}
     * (realtime). For video encoders this value corresponds to the intended frame rate,
     * although encoders are expected
     * to support variable frame rate based on {@link MediaCodec.BufferInfo#presentationTimeUs
     * buffer timestamp}. This key is not used in the {@code MediaCodec}
     * {@link MediaCodec#getInputFormat input}/{@link MediaCodec#getOutputFormat output} formats,
     * nor by {@link MediaMuxer#addTrack MediaMuxer}.
     */
    public static readonly KEY_FRAME_RATE: string = 'frame-rate';

    /**
     * A key describing the width (in pixels) of each tile of the content in a
     * {@link #MIMETYPE_IMAGE_ANDROID_HEIC} track. The associated value is an integer.
     *
     * Refer to {@link #MIMETYPE_IMAGE_ANDROID_HEIC} on decoding instructions of such tracks.
     *
     * @see #KEY_TILE_HEIGHT
     * @see #KEY_GRID_ROWS
     * @see #KEY_GRID_COLUMNS
     */
    public static readonly KEY_TILE_WIDTH: string = 'tile-width';

    /**
     * A key describing the height (in pixels) of each tile of the content in a
     * {@link #MIMETYPE_IMAGE_ANDROID_HEIC} track. The associated value is an integer.
     *
     * Refer to {@link #MIMETYPE_IMAGE_ANDROID_HEIC} on decoding instructions of such tracks.
     *
     * @see #KEY_TILE_WIDTH
     * @see #KEY_GRID_ROWS
     * @see #KEY_GRID_COLUMNS
     */
    public static readonly KEY_TILE_HEIGHT: string = 'tile-height';

    /**
     * A key describing the number of grid rows in the content in a
     * {@link #MIMETYPE_IMAGE_ANDROID_HEIC} track. The associated value is an integer.
     *
     * Refer to {@link #MIMETYPE_IMAGE_ANDROID_HEIC} on decoding instructions of such tracks.
     *
     * @see #KEY_TILE_WIDTH
     * @see #KEY_TILE_HEIGHT
     * @see #KEY_GRID_COLUMNS
     */
    public static readonly KEY_GRID_ROWS: string = 'grid-rows';

    /**
     * A key describing the number of grid columns in the content in a
     * {@link #MIMETYPE_IMAGE_ANDROID_HEIC} track. The associated value is an integer.
     *
     * Refer to {@link #MIMETYPE_IMAGE_ANDROID_HEIC} on decoding instructions of such tracks.
     *
     * @see #KEY_TILE_WIDTH
     * @see #KEY_TILE_HEIGHT
     * @see #KEY_GRID_ROWS
     */
    public static readonly KEY_GRID_COLUMNS: string = 'grid-cols';

    /**
     * A key describing the raw audio sample encoding/format.
     *
     * <p>The associated value is an integer, using one of the
     * {@link AudioFormat}.ENCODING_PCM_ values.</p>
     *
     * <p>This is an optional key for audio decoders and encoders specifying the
     * desired raw audio sample format during {@link MediaCodec#configure
     * MediaCodec.configure(&hellip;)} call. Use {@link MediaCodec#getInputFormat
     * MediaCodec.getInput}/{@link MediaCodec#getOutputFormat OutputFormat(&hellip;)}
     * to confirm the actual format. For the PCM decoder this key specifies both
     * input and output sample encodings.</p>
     *
     * <p>This key is also used by {@link MediaExtractor} to specify the sample
     * format of audio data, if it is specified.</p>
     *
     * <p>If this key is missing, the raw audio sample format is signed 16-bit short.</p>
     */
    public static readonly KEY_PCM_ENCODING: string = 'pcm-encoding';

    /**
     * A key describing the capture rate of a video format in frames/sec.
     * <p>
     * When capture rate is different than the frame rate, it means that the
     * video is acquired at a different rate than the playback, which produces
     * slow motion or timelapse effect during playback. Application can use the
     * value of this key to tell the relative speed ratio between capture and
     * playback rates when the video was recorded.
     * </p>
     * <p>
     * The associated value is an integer or a float.
     * </p>
     */
    public static readonly KEY_CAPTURE_RATE: string = 'capture-rate';

    /**
     * A key describing the frequency of key frames expressed in seconds between key frames.
     * <p>
     * This key is used by video encoders.
     * A negative value means no key frames are requested after the first frame.
     * A zero value means a stream containing all key frames is requested.
     * <p class=note>
     * Most video encoders will convert this value of the number of non-key-frames between
     * key-frames, using the {@linkplain #KEY_FRAME_RATE frame rate} information; therefore,
     * if the actual frame rate differs (e.g. input frames are dropped or the frame rate
     * changes), the <strong>time interval</strong> between key frames will not be the
     * configured value.
     * <p>
     * The associated value is an integer (or float since
     * {@link android.os.Build.VERSION_CODES#N_MR1}).
     */
    public static readonly KEY_I_FRAME_INTERVAL: string = 'i-frame-interval';

    /**
     * An optional key describing the period of intra refresh in frames. This is an
     * optional parameter that applies only to video encoders. If encoder supports it
     * ({@link MediaCodecInfo.CodecCapabilities#FEATURE_IntraRefresh}), the whole
     * frame is completely refreshed after the specified period. Also for each frame,
     * a fix subset of macroblocks must be intra coded which leads to more constant bitrate
     * than inserting a key frame. This key is recommended for video streaming applications
     * as it provides low-delay and good error-resilience. This key is ignored if the
     * video encoder does not support the intra refresh feature. Use the output format to
     * verify that this feature was enabled.
     * The associated value is an integer.
     */
    public static readonly KEY_INTRA_REFRESH_PERIOD: string = 'intra-refresh-period';

    /**
     * An optional key describing whether encoders prepend headers to sync frames (e.g.
     * SPS and PPS to IDR frames for H.264). This is an optional parameter that applies only
     * to video encoders. A video encoder may not support this feature; the component will fail
     * to configure in that case. For other components, this key is ignored.
     *
     * The value is an integer, with 1 indicating to prepend headers to every sync frames,
     * or 0 otherwise. The default value is 0.
     */
    public static readonly KEY_PREPEND_HEADER_TO_SYNC_FRAMES: string = 'prepend-sps-pps-to-idr-frames';

    /**
     * A key describing the temporal layering schema.  This is an optional parameter
     * that applies only to video encoders.  Use {@link MediaCodec#getOutputFormat}
     * after {@link MediaCodec#configure configure} to query if the encoder supports
     * the desired schema. Supported values are {@code webrtc.vp8.N-layer},
     * {@code android.generic.N}, {@code android.generic.N+M} and {@code none}, where
     * {@code N} denotes the total number of non-bidirectional layers (which must be at least 1)
     * and {@code M} denotes the total number of bidirectional layers (which must be non-negative).
     * <p class=note>{@code android.generic.*} schemas have been added in {@link
     * android.os.Build.VERSION_CODES#N_MR1}.
     * <p>
     * The encoder may support fewer temporal layers, in which case the output format
     * will contain the configured schema. If the encoder does not support temporal
     * layering, the output format will not have an entry with this key.
     * The associated value is a string.
     */
    public static readonly KEY_TEMPORAL_LAYERING: string = 'ts-schema';

    /**
     * A key describing the stride of the video bytebuffer layout.
     * Stride (or row increment) is the difference between the index of a pixel
     * and that of the pixel directly underneath. For YUV 420 formats, the
     * stride corresponds to the Y plane; the stride of the U and V planes can
     * be calculated based on the color format, though it is generally undefined
     * and depends on the device and release.
     * The associated value is an integer, representing number of bytes.
     */
    public static readonly KEY_STRIDE: string = 'stride';

    /**
     * A key describing the plane height of a multi-planar (YUV) video bytebuffer layout.
     * Slice height (or plane height/vertical stride) is the number of rows that must be skipped
     * to get from the top of the Y plane to the top of the U plane in the bytebuffer. In essence
     * the offset of the U plane is sliceHeight * stride. The height of the U/V planes
     * can be calculated based on the color format, though it is generally undefined
     * and depends on the device and release.
     * The associated value is an integer, representing number of rows.
     */
    public static readonly KEY_SLICE_HEIGHT: string = 'slice-height';

    /**
     * Applies only when configuring a video encoder in "surface-input" mode.
     * The associated value is a long and gives the time in microseconds
     * after which the frame previously submitted to the encoder will be
     * repeated (once) if no new frame became available since.
     */
    public static readonly KEY_REPEAT_PREVIOUS_FRAME_AFTER: string = 'repeat-previous-frame-after';

    /**
     * Instruct the video encoder in "surface-input" mode to drop excessive
     * frames from the source, so that the input frame rate to the encoder
     * does not exceed the specified fps.
     *
     * The associated value is a float, representing the max frame rate to
     * feed the encoder at.
     *
     */
    public static readonly KEY_MAX_FPS_TO_ENCODER: string = 'max-fps-to-encoder';

    /**
     * Instruct the video encoder in "surface-input" mode to limit the gap of
     * timestamp between any two adjacent frames fed to the encoder to the
     * specified amount (in micro-second).
     *
     * The associated value is a long int. When positive, it represents the max
     * timestamp gap between two adjacent frames fed to the encoder. When negative,
     * the absolute value represents a fixed timestamp gap between any two adjacent
     * frames fed to the encoder. Note that this will also apply even when the
     * original timestamp goes backward in time. Under normal conditions, such frames
     * would be dropped and not sent to the encoder.
     *
     * The output timestamp will be restored to the original timestamp and will
     * not be affected.
     *
     * This is used in some special scenarios where input frames arrive sparingly
     * but it's undesirable to allocate more bits to any single frame, or when it's
     * important to ensure all frames are captured (rather than captured in the
     * correct order).
     *
     */
    public static readonly KEY_MAX_PTS_GAP_TO_ENCODER: string = 'max-pts-gap-to-encoder';

    /**
     * If specified when configuring a video encoder that's in "surface-input"
     * mode, it will instruct the encoder to put the surface source in suspended
     * state when it's connected. No video frames will be accepted until a resume
     * operation (see {@link MediaCodec#PARAMETER_KEY_SUSPEND}), optionally with
     * timestamp specified via {@link MediaCodec#PARAMETER_KEY_SUSPEND_TIME}, is
     * received.
     *
     * The value is an integer, with 1 indicating to create with the surface
     * source suspended, or 0 otherwise. The default value is 0.
     *
     * If this key is not set or set to 0, the surface source will accept buffers
     * as soon as it's connected to the encoder (although they may not be encoded
     * immediately). This key can be used when the client wants to prepare the
     * encoder session in advance, but do not want to accept buffers immediately.
     */
    public static readonly KEY_CREATE_INPUT_SURFACE_SUSPENDED: string = 'create-input-buffers-suspended';

    /**
     * If specified when configuring a video decoder rendering to a surface,
     * causes the decoder to output "blank", i.e. black frames to the surface
     * when stopped to clear out any previously displayed contents.
     * The associated value is an integer of value 1.
     */
    public static readonly KEY_PUSH_BLANK_BUFFERS_ON_STOP: string = 'push-blank-buffers-on-shutdown';

    /**
     * A key describing the duration (in microseconds) of the content.
     * The associated value is a long.
     */
    public static readonly KEY_DURATION: string = 'durationUs';

    /**
     * A key mapping to a value of 1 if the content is AAC audio and
     * audio frames are prefixed with an ADTS header.
     * The associated value is an integer (0 or 1).
     * This key is only supported when _decoding_ content, it cannot
     * be used to configure an encoder to emit ADTS output.
     */
    public static readonly KEY_IS_ADTS: string = 'is-adts';

    /**
     * A key describing the channel composition of audio content. This mask
     * is composed of bits drawn from channel mask definitions in {@link android.media.AudioFormat}.
     * The associated value is an integer.
     */
    public static readonly KEY_CHANNEL_MASK: string = 'channel-mask';

    /**
     * A key describing the AAC profile to be used (AAC audio formats only).
     * Constants are declared in {@link android.media.MediaCodecInfo.CodecProfileLevel}.
     */
    public static readonly KEY_AAC_PROFILE: string = 'aac-profile';

    /**
     * A key describing the AAC SBR mode to be used (AAC audio formats only).
     * The associated value is an integer and can be set to following values:
     * <ul>
     * <li>0 - no SBR should be applied</li>
     * <li>1 - single rate SBR</li>
     * <li>2 - double rate SBR</li>
     * </ul>
     * Note: If this key is not defined the default SRB mode for the desired AAC profile will
     * be used.
     * <p>This key is only used during encoding.
     */
    public static readonly KEY_AAC_SBR_MODE: string = 'aac-sbr-mode';

    /**
     * A key describing the maximum number of channels that can be output by the AAC decoder.
     * By default, the decoder will output the same number of channels as present in the encoded
     * stream, if supported. Set this value to limit the number of output channels, and use
     * the downmix information in the stream, if available.
     * <p>Values larger than the number of channels in the content to decode are ignored.
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_MAX_OUTPUT_CHANNEL_COUNT: string = 'aac-max-output-channel_count';

    /**
     * A key describing a gain to be applied so that the output loudness matches the
     * Target Reference Level. This is typically used to normalize loudness across program items.
     * The gain is derived as the difference between the Target Reference Level and the
     * Program Reference Level. The latter can be given in the bitstream and indicates the actual
     * loudness value of the program item.
     * <p>The Target Reference Level controls loudness normalization for both MPEG-4 DRC and
     * MPEG-D DRC.
     * <p>The value is given as an integer value between
     * 40 and 127, and is calculated as -4 * Target Reference Level in LKFS.
     * Therefore, it represents the range of -10 to -31.75 LKFS.
     * <p>The default value on mobile devices is 64 (-16 LKFS).
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_DRC_TARGET_REFERENCE_LEVEL: string = 'aac-target-ref-level';

    /**
     * A key describing for selecting the DRC effect type for MPEG-D DRC.
     * The supported values are defined in ISO/IEC 23003-4:2015 and are described as follows:
     * <table>
     * <tr><th>Value</th><th>Effect</th></tr>
     * <tr><th>-1</th><th>Off</th></tr>
     * <tr><th>0</th><th>None</th></tr>
     * <tr><th>1</th><th>Late night</th></tr>
     * <tr><th>2</th><th>Noisy environment</th></tr>
     * <tr><th>3</th><th>Limited playback range</th></tr>
     * <tr><th>4</th><th>Low playback level</th></tr>
     * <tr><th>5</th><th>Dialog enhancement</th></tr>
     * <tr><th>6</th><th>General compression</th></tr>
     * </table>
     * <p>The value -1 (Off) disables DRC processing, while loudness normalization may still be
     * active and dependent on KEY_AAC_DRC_TARGET_REFERENCE_LEVEL.<br>
     * The value 0 (None) automatically enables DRC processing if necessary to prevent signal
     * clipping<br>
     * The value 6 (General compression) can be used for enabling MPEG-D DRC without particular
     * DRC effect type request.<br>
     * The default DRC effect type is 3 ("Limited playback range") on mobile devices.
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_DRC_EFFECT_TYPE: string = 'aac-drc-effect-type';

    /**
     * A key describing the target reference level that was assumed at the encoder for
     * calculation of attenuation gains for clipping prevention.
     * <p>If it is known, this information can be provided as an integer value between
     * 0 and 127, which is calculated as -4 * Encoded Target Level in LKFS.
     * If the Encoded Target Level is unknown, the value can be set to -1.
     * <p>The default value is -1 (unknown).
     * <p>The value is ignored when heavy compression is used (see
     * {@link #KEY_AAC_DRC_HEAVY_COMPRESSION}).
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_ENCODED_TARGET_LEVEL: string = 'aac-encoded-target-level';

    /**
     * A key describing the boost factor allowing to adapt the dynamics of the output to the
     * actual listening requirements. This relies on DRC gain sequences that can be transmitted in
     * the encoded bitstream to be able to reduce the dynamics of the output signal upon request.
     * This factor enables the user to select how much of the gains are applied.
     * <p>Positive gains (boost) and negative gains (attenuation, see
     * {@link #KEY_AAC_DRC_ATTENUATION_FACTOR}) can be controlled separately for a better match
     * to different use-cases.
     * <p>Typically, attenuation gains are sent for loud signal segments, and boost gains are sent
     * for soft signal segments. If the output is listened to in a noisy environment, for example,
     * the boost factor is used to enable the positive gains, i.e. to amplify soft signal segments
     * beyond the noise floor. But for listening late at night, the attenuation
     * factor is used to enable the negative gains, to prevent loud signal from surprising
     * the listener. In applications which generally need a low dynamic range, both the boost factor
     * and the attenuation factor are used in order to enable all DRC gains.
     * <p>In order to prevent clipping, it is also recommended to apply the attenuation gains
     * in case of a downmix and/or loudness normalization to high target reference levels.
     * <p>Both the boost and the attenuation factor parameters are given as integer values
     * between 0 and 127, representing the range of the factor of 0 (i.e. don't apply)
     * to 1 (i.e. fully apply boost/attenuation gains respectively).
     * <p>The default value is 127 (fully apply boost DRC gains).
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_DRC_BOOST_FACTOR: string = 'aac-drc-boost-level';

    /**
     * A key describing the attenuation factor allowing to adapt the dynamics of the output to the
     * actual listening requirements.
     * See {@link #KEY_AAC_DRC_BOOST_FACTOR} for a description of the role of this attenuation
     * factor and the value range.
     * <p>The default value is 127 (fully apply attenuation DRC gains).
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_DRC_ATTENUATION_FACTOR: string = 'aac-drc-cut-level';

    /**
     * A key describing the selection of the heavy compression profile for DRC.
     * Two separate DRC gain sequences can be transmitted in one bitstream: MPEG-4 DRC light
     * compression, and DVB-specific heavy compression. When selecting the application of the heavy
     * compression, one of the sequences is selected:
     * <ul>
     * <li>0 enables light compression,</li>
     * <li>1 enables heavy compression instead.
     * </ul>
     * Note that only light compression offers the features of scaling of DRC gains
     * (see {@link #KEY_AAC_DRC_BOOST_FACTOR} and {@link #KEY_AAC_DRC_ATTENUATION_FACTOR} for the
     * boost and attenuation factors, and frequency-selective (multiband) DRC.
     * Light compression usually contains clipping prevention for stereo downmixing while heavy
     * compression, if additionally provided in the bitstream, is usually stronger, and contains
     * clipping prevention for stereo and mono downmixing.
     * <p>The default is 1 (heavy compression).
     * <p>This key is only used during decoding.
     */
    public static readonly KEY_AAC_DRC_HEAVY_COMPRESSION: string = 'aac-drc-heavy-compression';

    /**
     * A key describing the FLAC compression level to be used (FLAC audio format only).
     * The associated value is an integer ranging from 0 (fastest, least compression)
     * to 8 (slowest, most compression).
     */
    public static readonly KEY_FLAC_COMPRESSION_LEVEL: string = 'flac-compression-level';

    /**
     * A key describing the encoding complexity.
     * The associated value is an integer.  These values are device and codec specific,
     * but lower values generally result in faster and/or less power-hungry encoding.
     *
     * @see MediaCodecInfo.EncoderCapabilities#getComplexityRange()
     */
    public static readonly KEY_COMPLEXITY: string = 'complexity';

    /**
     * A key describing the desired encoding quality.
     * The associated value is an integer.  This key is only supported for encoders
     * that are configured in constant-quality mode.  These values are device and
     * codec specific, but lower values generally result in more efficient
     * (smaller-sized) encoding.
     *
     * @see MediaCodecInfo.EncoderCapabilities#getQualityRange()
     */
    public static readonly KEY_QUALITY: string = 'quality';

    /**
     * A key describing the desired codec priority.
     * <p>
     * The associated value is an integer. Higher value means lower priority.
     * <p>
     * Currently, only two levels are supported:<br>
     * 0: realtime priority - meaning that the codec shall support the given
     *    performance configuration (e.g. framerate) at realtime. This should
     *    only be used by media playback, capture, and possibly by realtime
     *    communication scenarios if best effort performance is not suitable.<br>
     * 1: non-realtime priority (best effort).
     * <p>
     * This is a hint used at codec configuration and resource planning - to understand
     * the realtime requirements of the application; however, due to the nature of
     * media components, performance is not guaranteed.
     *
     */
    public static readonly KEY_PRIORITY: string = 'priority';

    /**
     * A key describing the desired operating frame rate for video or sample rate for audio
     * that the codec will need to operate at.
     * <p>
     * The associated value is an integer or a float representing frames-per-second or
     * samples-per-second
     * <p>
     * This is used for cases like high-speed/slow-motion video capture, where the video encoder
     * format contains the target playback rate (e.g. 30fps), but the component must be able to
     * handle the high operating capture rate (e.g. 240fps).
     * <p>
     * This rate will be used by codec for resource planning and setting the operating points.
     *
     */
    public static readonly KEY_OPERATING_RATE: string = 'operating-rate';

    /**
     * A key describing the desired profile to be used by an encoder.
     * The associated value is an integer.
     * Constants are declared in {@link MediaCodecInfo.CodecProfileLevel}.
     * This key is used as a hint, and is only supported for codecs
     * that specify a profile. Note: Codecs are free to use all the available
     * coding tools at the specified profile.
     *
     * @see MediaCodecInfo.CodecCapabilities#profileLevels
     */
    public static readonly KEY_PROFILE: string = 'profile';

    /**
     * A key describing the desired profile to be used by an encoder.
     * The associated value is an integer.
     * Constants are declared in {@link MediaCodecInfo.CodecProfileLevel}.
     * This key is used as a further hint when specifying a desired profile,
     * and is only supported for codecs that specify a level.
     * <p>
     * This key is ignored if the {@link #KEY_PROFILE profile} is not specified.
     *
     * @see MediaCodecInfo.CodecCapabilities#profileLevels
     */
    public static readonly KEY_LEVEL: string = 'level';

    /**
     * An optional key describing the desired encoder latency in frames. This is an optional
     * parameter that applies only to video encoders. If encoder supports it, it should ouput
     * at least one output frame after being queued the specified number of frames. This key
     * is ignored if the video encoder does not support the latency feature. Use the output
     * format to verify that this feature was enabled and the actual value used by the encoder.
     * <p>
     * If the key is not specified, the default latency will be implenmentation specific.
     * The associated value is an integer.
     */
    public static readonly KEY_LATENCY: string = 'latency';

    /**
     * An optional key describing the maximum number of non-display-order coded frames.
     * This is an optional parameter that applies only to video encoders. Application should
     * check the value for this key in the output format to see if codec will produce
     * non-display-order coded frames. If encoder supports it, the output frames' order will be
     * different from the display order and each frame's display order could be retrived from
     * {@link MediaCodec.BufferInfo#presentationTimeUs}. Before API level 27, application may
     * receive non-display-order coded frames even though the application did not request it.
     * Note: Application should not rearrange the frames to display order before feeding them
     * to {@link MediaMuxer#writeSampleData}.
     * <p>
     * The default value is 0.
     */
    public static readonly KEY_OUTPUT_REORDER_DEPTH: string = 'output-reorder-depth';

    /**
     * A key describing the desired clockwise rotation on an output surface.
     * This key is only used when the codec is configured using an output surface.
     * The associated value is an integer, representing degrees. Supported values
     * are 0, 90, 180 or 270. This is an optional field; if not specified, rotation
     * defaults to 0.
     *
     * @see MediaCodecInfo.CodecCapabilities#profileLevels
     */
    public static readonly KEY_ROTATION: string = 'rotation-degrees';

    /**
     * A key describing the desired bitrate mode to be used by an encoder.
     * Constants are declared in {@link MediaCodecInfo.CodecCapabilities}.
     *
     * @see MediaCodecInfo.EncoderCapabilities#isBitrateModeSupported(int)
     */
    public static readonly KEY_BITRATE_MODE: string = 'bitrate-mode';

    /**
     * A key describing the audio session ID of the AudioTrack associated
     * to a tunneled video codec.
     * The associated value is an integer.
     *
     * @see MediaCodecInfo.CodecCapabilities#FEATURE_TunneledPlayback
     */
    public static readonly KEY_AUDIO_SESSION_ID: string = 'audio-session-id';

    /**
     * A key for boolean AUTOSELECT behavior for the track. Tracks with AUTOSELECT=true
     * are considered when automatically selecting a track without specific user
     * choice, based on the current locale.
     * This is currently only used for subtitle tracks, when the user selected
     * 'Default' for the captioning locale.
     * The associated value is an integer, where non-0 means TRUE.  This is an optional
     * field; if not specified, AUTOSELECT defaults to TRUE.
     */
    public static readonly KEY_IS_AUTOSELECT: string = 'is-autoselect';

    /**
     * A key for boolean DEFAULT behavior for the track. The track with DEFAULT=true is
     * selected in the absence of a specific user choice.
     * This is currently used in two scenarios:
     * 1) for subtitle tracks, when the user selected 'Default' for the captioning locale.
     * 2) for a {@link #MIMETYPE_IMAGE_ANDROID_HEIC} track, indicating the image is the
     * primary item in the file.

     * The associated value is an integer, where non-0 means TRUE.  This is an optional
     * field; if not specified, DEFAULT is considered to be FALSE.
     */
    public static readonly KEY_IS_DEFAULT: string = 'is-default';

    /**
     * A key for the FORCED field for subtitle tracks. True if it is a
     * forced subtitle track.  Forced subtitle tracks are essential for the
     * content and are shown even when the user turns off Captions.  They
     * are used for example to translate foreign/alien dialogs or signs.
     * The associated value is an integer, where non-0 means TRUE.  This is an
     * optional field; if not specified, FORCED defaults to FALSE.
     */
    public static readonly KEY_IS_FORCED_SUBTITLE: string = 'is-forced-subtitle';

    /**
     * A key describing the number of haptic channels in an audio format.
     * The associated value is an integer.
     */
    public static readonly KEY_HAPTIC_CHANNEL_COUNT: string = 'haptic-channel-count';

    /** @hide */
    public static readonly KEY_IS_TIMED_TEXT: string = 'is-timed-text';

    // The following color aspect values must be in sync with the ones in HardwareAPI.h.
    /**
     * An optional key describing the color primaries, white point and
     * luminance factors for video content.
     *
     * The associated value is an integer: 0 if unspecified, or one of the
     * COLOR_STANDARD_ values.
     */
    public static readonly KEY_COLOR_STANDARD: string = 'color-standard';

    /** BT.709 color chromacity coordinates with KR = 0.2126, KB = 0.0722. */
    public static readonly COLOR_STANDARD_BT709: number = 1;

    /** BT.601 625 color chromacity coordinates with KR = 0.299, KB = 0.114. */
    public static readonly COLOR_STANDARD_BT601_PAL: number = 2;

    /** BT.601 525 color chromacity coordinates with KR = 0.299, KB = 0.114. */
    public static readonly COLOR_STANDARD_BT601_NTSC: number = 4;

    /** BT.2020 color chromacity coordinates with KR = 0.2627, KB = 0.0593. */
    public static readonly COLOR_STANDARD_BT2020: number = 6;

    // /** @hide */
    // @IntDef({
    //     COLOR_STANDARD_BT709,
    //     COLOR_STANDARD_BT601_PAL,
    //     COLOR_STANDARD_BT601_NTSC,
    //     COLOR_STANDARD_BT2020,
    // })
    // @Retention(RetentionPolicy.SOURCE)
    // public @interface ColorStandard {}

    /**
     * An optional key describing the opto-electronic transfer function used
     * for the video content.
     *
     * The associated value is an integer: 0 if unspecified, or one of the
     * COLOR_TRANSFER_ values.
     */
    public static readonly KEY_COLOR_TRANSFER: string = 'color-transfer';

    /** Linear transfer characteristic curve. */
    public static readonly COLOR_TRANSFER_LINEAR: number = 1;

    /** SMPTE 170M transfer characteristic curve used by BT.601/BT.709/BT.2020. This is the curve
     *  used by most non-HDR video content. */
    public static readonly COLOR_TRANSFER_SDR_VIDEO: number = 3;

    /** SMPTE ST 2084 transfer function. This is used by some HDR video content. */
    public static readonly COLOR_TRANSFER_ST2084: number = 6;

    /** ARIB STD-B67 hybrid-log-gamma transfer function. This is used by some HDR video content. */
    public static readonly COLOR_TRANSFER_HLG: number = 7;

    /** @hide */
    // @IntDef({
    //     COLOR_TRANSFER_LINEAR,
    //     COLOR_TRANSFER_SDR_VIDEO,
    //     COLOR_TRANSFER_ST2084,
    //     COLOR_TRANSFER_HLG,
    // })
    // @Retention(RetentionPolicy.SOURCE)
    // public @interface ColorTransfer {}

    /**
     * An optional key describing the range of the component values of the video content.
     *
     * The associated value is an integer: 0 if unspecified, or one of the
     * COLOR_RANGE_ values.
     */
    public static readonly KEY_COLOR_RANGE: string = 'color-range';

    /** Limited range. Y component values range from 16 to 235 for 8-bit content.
     *  Cr, Cy values range from 16 to 240 for 8-bit content.
     *  This is the default for video content. */
    public static readonly COLOR_RANGE_LIMITED: number = 2;

    /** Full range. Y, Cr and Cb component values range from 0 to 255 for 8-bit content. */
    public static readonly COLOR_RANGE_FULL: number = 1;

    // /** @hide */
    // @IntDef({
    //     COLOR_RANGE_LIMITED,
    //     COLOR_RANGE_FULL,
    // })
    // @Retention(RetentionPolicy.SOURCE)
    // public @interface ColorRange {}

    /**
     * An optional key describing the static metadata of HDR (high-dynamic-range) video content.
     *
     * The associated value is a ByteBuffer. This buffer contains the raw contents of the
     * Static Metadata Descriptor (including the descriptor ID) of an HDMI Dynamic Range and
     * Mastering InfoFrame as defined by CTA-861.3. This key must be provided to video decoders
     * for HDR video content unless this information is contained in the bitstream and the video
     * decoder supports an HDR-capable profile. This key must be provided to video encoders for
     * HDR video content.
     */
    public static readonly KEY_HDR_STATIC_INFO: string = 'hdr-static-info';

    /**
     * An optional key describing the HDR10+ metadata of the video content.
     *
     * The associated value is a ByteBuffer containing HDR10+ metadata conforming to the
     * user_data_registered_itu_t_t35() syntax of SEI message for ST 2094-40. This key will
     * be present on:
     *<p>
     * - The formats of output buffers of a decoder configured for HDR10+ profiles (such as
     *   {@link MediaCodecInfo.CodecProfileLevel#VP9Profile2HDR10Plus}, {@link
     *   MediaCodecInfo.CodecProfileLevel#VP9Profile3HDR10Plus} or {@link
     *   MediaCodecInfo.CodecProfileLevel#HEVCProfileMain10HDR10Plus}), or
     *<p>
     * - The formats of output buffers of an encoder configured for an HDR10+ profiles that
     *   uses out-of-band metadata (such as {@link
     *   MediaCodecInfo.CodecProfileLevel#VP9Profile2HDR10Plus} or {@link
     *   MediaCodecInfo.CodecProfileLevel#VP9Profile3HDR10Plus}).
     *
     * @see MediaCodec#PARAMETER_KEY_HDR10_PLUS_INFO
     */
    public static readonly KEY_HDR10_PLUS_INFO: string = 'hdr10-plus-info';

    /**
     * A key describing a unique ID for the content of a media track.
     *
     * <p>This key is used by {@link MediaExtractor}. Some extractors provide multiple encodings
     * of the same track (e.g. float audio tracks for FLAC and WAV may be expressed as two
     * tracks via MediaExtractor: a normal PCM track for backward compatibility, and a float PCM
     * track for added fidelity. Similarly, Dolby Vision extractor may provide a baseline SDR
     * version of a DV track.) This key can be used to identify which MediaExtractor tracks refer
     * to the same underlying content.
     * </p>
     *
     * The associated value is an integer.
     */
    public static readonly KEY_TRACK_ID: string = 'track-id';

    /**
     * A key describing the system id of the conditional access system used to scramble
     * a media track.
     * <p>
     * This key is set by {@link MediaExtractor} if the track is scrambled with a conditional
     * access system, regardless of the presence of a valid {@link MediaCas} object.
     * <p>
     * The associated value is an integer.
     * @hide
     */
    public static readonly KEY_CA_SYSTEM_ID: string = 'ca-system-id';

    /**
     * A key describing the {@link MediaCas.Session} object associated with a media track.
     * <p>
     * This key is set by {@link MediaExtractor} if the track is scrambled with a conditional
     * access system, after it receives a valid {@link MediaCas} object.
     * <p>
     * The associated value is a ByteBuffer.
     * @hide
     */
    public static readonly KEY_CA_SESSION_ID: string = 'ca-session-id';

    /**
     * A key describing the private data in the CA_descriptor associated with a media track.
     * <p>
     * This key is set by {@link MediaExtractor} if the track is scrambled with a conditional
     * access system, before it receives a valid {@link MediaCas} object.
     * <p>
     * The associated value is a ByteBuffer.
     * @hide
     */
    public static readonly KEY_CA_PRIVATE_DATA: string = 'ca-private-data';

    /**
     * A key describing the maximum number of B frames between I or P frames,
     * to be used by a video encoder.
     * The associated value is an integer. The default value is 0, which means
     * that no B frames are allowed. Note that non-zero value does not guarantee
     * B frames; it's up to the encoder to decide.
     */
    public static readonly KEY_MAX_B_FRAMES: string = 'max-bframes';
}

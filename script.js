const SUPABASE_URL =
    "https://yoflvktmovseppukqdio.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_L9U9B8viS8bD85N1kmUm5g_qM5YpQ3a";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ================= SETTINGS =================

const defaultSettings = {

    dayPrice: 70,

    nightPrice: 80,

    nightStart: "19:30",

    open: "17:00",

    close: "01:00",

    ownerOne: "201116733739",

    ownerTwo: "201554093227"

};


let settings = {
    ...defaultSettings
};


// ================= STATE =================

let selectedSlot = null;

let bookedSlots = [];


// ================= ELEMENTS =================

const dateInput =
    document.getElementById("bookingDate");

const durationInput =
    document.getElementById("duration");

const slotsEl =
    document.getElementById("slots");

const selectedSummary =
    document.getElementById("selectedSummary");

const bookingForm =
    document.getElementById("bookingForm");

const weeklyOptions =
    document.getElementById("weeklyOptions");

const weeklyEndDate =
    document.getElementById("weeklyEndDate");

const messageEl =
    document.getElementById("message");


// ================= YEAR =================

const yearElement =
    document.getElementById("year");

if(yearElement){

    yearElement.textContent =
        new Date().getFullYear();

}


// ================= HELPERS =================

function pad(n){

    return String(n)
        .padStart(2, "0");

}


function localISODate(
    d = new Date()
){

    return `${d.getFullYear()}-${pad(
        d.getMonth() + 1
    )}-${pad(
        d.getDate()
    )}`;

}


function futureDate(days){

    const d =
        new Date();

    d.setDate(
        d.getDate() + days
    );

    return localISODate(d);

}


function timeToMinutes(time){

    if(!time)
        return 0;

    const value =
        String(time)
        .substring(0, 5);

    const parts =
        value.split(":");

    const h =
        Number(parts[0]) || 0;

    const m =
        Number(parts[1]) || 0;

    return (
        h * 60 +
        m
    );

}


function minutesToTime(minutes){

    minutes =
        ((minutes % 1440) + 1440) % 1440;

    const h =
        Math.floor(
            minutes / 60
        );

    const m =
        minutes % 60;

    const suffix =
        h < 12
            ? "ص"
            : "م";

    const hh =
        h % 12 || 12;

    return `${hh}:${pad(m)} ${suffix}`;

}


function dateLabel(value){

    if(!value)
        return "";

    const d =
        new Date(
            value +
            "T12:00:00"
        );

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(d);

}


// ================= TIME CALCULATIONS =================

function endTime(
    start,
    duration
){

    const startMinutes =
        timeToMinutes(start);

    const result =
        startMinutes +
        Number(duration);

    return `${pad(
        Math.floor(
            (result % 1440) / 60
        )
    )}:${pad(
        result % 60
    )}`;

}


// تحويل الوقت إلى خط زمني خاص بالملعب.
//
// الملعب يبدأ 17:00 وينتهي 01:00.
// لذلك 00:30 تعتبر بعد 17:00 وليست قبلها.

function timelineMinutes(time){

    let minutes =
        timeToMinutes(time);

    const open =
        timeToMinutes(
            settings.open
        );

    if(
        minutes < open
    ){

        minutes += 1440;

    }

    return minutes;

}


// ================= SETTINGS =================

async function loadSettings(){

    try{

        const {
            data,
            error
        } =
            await supabaseClient
                .from("settings")
                .select(`
                    day_price,
                    night_price,
                    night_start,
                    opening_time,
                    closing_time,
                    owner_one_phone,
                    owner_two_phone
                `)
                .eq("id", 1)
                .maybeSingle();


        if(error){

            console.warn(
                "Settings error:",
                error.message
            );

            return;

        }


        if(data){

            settings.dayPrice =
                Number(
                    data.day_price
                );

            settings.nightPrice =
                Number(
                    data.night_price
                );

            settings.nightStart =
                String(
                    data.night_start
                ).substring(0, 5);

            settings.open =
                String(
                    data.opening_time
                ).substring(0, 5);

            settings.close =
                String(
                    data.closing_time
                ).substring(0, 5);

            settings.ownerOne =
                data.owner_one_phone ||
                "";

            settings.ownerTwo =
                data.owner_two_phone ||
                "";

        }

    }

    catch(error){

        console.warn(
            "Settings exception:",
            error
        );

    }

}


// ================= PRICE =================

function priceFor(
    start,
    duration
){

    const startMinutes =
        timeToMinutes(start);

    const nightStart =
        timeToMinutes(
            settings.nightStart
        );

    const hourly =
        startMinutes >= nightStart
            ?
            Number(
                settings.nightPrice
            )
            :
            Number(
                settings.dayPrice
            );

    return hourly *
        (
            Number(duration) /
            60
        );

}


// ================= OPERATING PERIOD =================

function getOperatingPeriod(){

    const open =
        timeToMinutes(
            settings.open
        );

    let close =
        timeToMinutes(
            settings.close
        );


    /*
        لو الإغلاق بعد منتصف الليل
        نضيف 24 ساعة.
    */

    if(close <= open){

        close += 1440;

    }


    return {
        open,
        close
    };

}


// ================= SLOTS =================

function makeSlots(){

    const slots = [];

    const {
        open,
        close
    } =
        getOperatingPeriod();


    const duration =
        Number(
            durationInput.value
        ) || 60;


    /*
        البداية كل 30 دقيقة.

        والأهم:
        لا نضيف أي موعد لو مدة الحجز
        ستتجاوز موعد إغلاق الملعب.
    */

    for(
        let minutes = open;

        minutes + duration <= close;

        minutes += 30
    ){

        const realMinutes =
            minutes % 1440;


        slots.push({

            start:
                `${pad(
                    Math.floor(
                        realMinutes / 60
                    )
                )}:${pad(
                    realMinutes % 60
                )}`,

            end:
                `${pad(
                    Math.floor(
                        (minutes + duration) % 1440 / 60
                    )
                )}:${pad(
                    (minutes + duration) % 60
                )}`

        });

    }


    return slots;

}


// ================= OVERLAP =================

function rangesOverlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    const aS =
        timelineMinutes(
            aStart
        );

    let aE =
        timelineMinutes(
            aEnd
        );


    const bS =
        timelineMinutes(
            bStart
        );

    let bE =
        timelineMinutes(
            bEnd
        );


    /*
        لو النهاية وصلت لليوم التالي.
    */

    if(aE <= aS){

        aE += 1440;

    }


    if(bE <= bS){

        bE += 1440;

    }


    /*
        مهم جدًا:

        لو عندنا:

        17:00 → 18:30

        ونجرب:

        18:30 → 19:30

        النتيجة FALSE

        لأن بداية الحجز الجديد
        تساوي نهاية الحجز القديم.
    */

    return (
        aS < bE &&
        bS < aE
    );

}


// ================= SUPABASE BOOKED SLOTS =================

async function loadBookedSlots(date){

    bookedSlots = [];


    const {
        data,
        error
    } =
        await supabaseClient
            .rpc(
                "get_booked_slots",
                {
                    p_date: date
                }
            );


    if(error){

        console.error(
            "get_booked_slots error:",
            error
        );


        showMessage(
            "حدث خطأ أثناء تحميل المواعيد. حاول مرة أخرى.",
            true
        );


        return false;

    }


    bookedSlots =
        Array.isArray(data)
            ? data
            : [];


    return true;

}


// ================= OCCUPIED =================

function isOccupied(
    start,
    duration
){

    const end =
        endTime(
            start,
            duration
        );


    return bookedSlots.some(
        booking => {

            if(
                !booking.start_time ||
                !booking.end_time
            ){

                return false;

            }


            return rangesOverlap(
                start,
                end,
                booking.start_time,
                booking.end_time
            );

        }
    );

}


// ================= MESSAGE =================

function showMessage(
    text,
    error = false
){

    if(!messageEl)
        return;


    messageEl.textContent =
        text;


    messageEl.classList.remove(
        "hidden",
        "error"
    );


    if(error){

        messageEl.classList.add(
            "error"
        );

    }

}


// ================= RENDER SLOTS =================

async function renderSlots(){

    selectedSlot =
        null;


    if(selectedSummary){

        selectedSummary
            .classList
            .add("hidden");

    }


    if(bookingForm){

        bookingForm
            .classList
            .add("hidden");

    }


    const date =
        dateInput.value;


    if(!date)
        return;


    const selectedDateLabel =
        document.getElementById(
            "selectedDateLabel"
        );


    if(selectedDateLabel){

        selectedDateLabel.textContent =
            dateLabel(date);

    }


    slotsEl.innerHTML = `

        <p class="muted">
            جاري تحميل المواعيد...
        </p>

    `;


    const success =
        await loadBookedSlots(
            date
        );


    if(!success){

        slotsEl.innerHTML = `

            <p class="muted">
                تعذر تحميل المواعيد.
            </p>

        `;

        return;

    }


    slotsEl.innerHTML =
        "";


    const slots =
        makeSlots();


    /*
        لو مفيش أي مواعيد ممكنة
    */

    if(!slots.length){

        slotsEl.innerHTML = `

            <p class="muted">
                لا توجد مواعيد متاحة بهذه المدة.
            </p>

        `;

        return;

    }


    slots.forEach(
        slot => {

            const occupied =
                isOccupied(
                    slot.start,
                    Number(
                        durationInput.value
                    )
                );


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "slot " +
                (
                    occupied
                        ?
                        "booked"
                        :
                        "available"
                );


            button.disabled =
                occupied;


            button.innerHTML = `

                <strong>

                    ${minutesToTime(
                        timeToMinutes(
                            slot.start
                        )
                    )}

                    -

                    ${minutesToTime(
                        timeToMinutes(
                            slot.end
                        )
                    )}

                </strong>

                <small>

                    ${
                        occupied
                        ?
                        "🔴 محجوز"
                        :
                        "🟢 متاح"
                    }

                </small>

            `;


            if(!occupied){

                button.addEventListener(
                    "click",
                    () => {

                        selectedSlot = {

                            start:
                                slot.start,

                            end:
                                slot.end,

                            duration:
                                Number(
                                    durationInput.value
                                ),

                            price:
                                priceFor(
                                    slot.start,
                                    Number(
                                        durationInput.value
                                    )
                                )

                        };


                        [
                            ...slotsEl.children
                        ]
                        .forEach(
                            item => {

                                item.classList
                                    .remove(
                                        "selected"
                                    );

                            }
                        );


                        button.classList
                            .add(
                                "selected"
                            );


                        renderSummary();

                    }
                );

            }


            slotsEl.appendChild(
                button
            );

        }
    );

}


// ================= SUMMARY =================

function renderSummary(){

    if(!selectedSlot)
        return;


    const selectedType =
        document.querySelector(
            'input[name="bookingType"]:checked'
        );


    const type =
        selectedType
            ?
            selectedType.value
            :
            "single";


    selectedSummary.innerHTML = `

        <strong>
            الموعد المختار
        </strong>

        <br>

        ${dateLabel(
            dateInput.value
        )}

        <br>

        ⏰

        ${minutesToTime(
            timeToMinutes(
                selectedSlot.start
            )
        )}

        -

        ${minutesToTime(
            timeToMinutes(
                selectedSlot.end
            )
        )}

        <br>

        ⏱️

        ${
            selectedSlot.duration === 60
            ?
            "ساعة"
            :
            selectedSlot.duration === 90
            ?
            "ساعة ونصف"
            :
            "ساعتان"
        }

        <br>

        💰

        ${selectedSlot.price}

        جنيه

        ${
            type === "weekly"
            ?
            "<br>🔄 حجز أسبوعي متكرر"
            :
            ""
        }

    `;


    selectedSummary
        .classList
        .remove("hidden");


    bookingForm
        .classList
        .remove("hidden");

}


// ================= BOOKING TYPE =================

document
    .querySelectorAll(
        'input[name="bookingType"]'
    )
    .forEach(
        radio => {

            radio.addEventListener(
                "change",
                () => {

                    document
                        .querySelectorAll(
                            ".choice"
                        )
                        .forEach(
                            item => {

                                item.classList
                                    .remove(
                                        "active"
                                    );

                            }
                        );


                    const choice =
                        radio.closest(
                            ".choice"
                        );


                    if(choice){

                        choice.classList
                            .add(
                                "active"
                            );

                    }


                    const weekly =
                        radio.value ===
                        "weekly";


                    weeklyOptions
                        .classList
                        .toggle(
                            "hidden",
                            !weekly
                        );


                    if(weekly){

                        weeklyEndDate.min =
                            dateInput.value;

                    }


                    renderSummary();

                }
            );

        }
    );


// ================= INITIAL DATE =================

dateInput.value =
    futureDate(1);


dateInput.min =
    localISODate();


weeklyEndDate.min =
    dateInput.value;


// ================= DATE CHANGE =================

dateInput.addEventListener(
    "change",
    () => {

        weeklyEndDate.min =
            dateInput.value;

        renderSlots();

    }
);


// ================= DURATION CHANGE =================

durationInput.addEventListener(
    "change",
    () => {

        renderSlots();

    }
);


// ================= SUBMIT BOOKING =================

bookingForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if(!selectedSlot){

            showMessage(
                "اختار موعد الأول.",
                true
            );

            return;

        }


        const name =
            document
                .getElementById(
                    "customerName"
                )
                .value
                .trim();


        const phone =
            document
                .getElementById(
                    "customerPhone"
                )
                .value
                .trim();


        const selectedType =
            document.querySelector(
                'input[name="bookingType"]:checked'
            );


        const type =
            selectedType
                ?
                selectedType.value
                :
                "single";


        const endDate =
            type === "weekly"
                ?
                weeklyEndDate.value
                :
                null;


        if(!name){

            showMessage(
                "اكتب اسمك.",
                true
            );

            return;

        }


        if(!phone){

            showMessage(
                "اكتب رقم الموبايل.",
                true
            );

            return;

        }


        if(
            type === "weekly" &&
            (
                !endDate ||
                endDate <
                dateInput.value
            )
        ){

            showMessage(
                "اختار تاريخ نهاية صحيح للحجز الأسبوعي.",
                true
            );

            return;

        }


        showMessage(
            "جاري التأكد من توفر الموعد..."
        );


        /*
            إعادة تحميل الحجوزات من Supabase
            قبل الحفظ.
        */

        const freshCheck =
            await loadBookedSlots(
                dateInput.value
            );


        if(!freshCheck){

            return;

        }


        /*
            فحص التداخل الحقيقي.
        */

        if(
            isOccupied(
                selectedSlot.start,
                selectedSlot.duration
            )
        ){

            showMessage(
                "الموعد لم يعد متاحًا. اختار موعدًا آخر.",
                true
            );


            await renderSlots();

            return;

        }


        /*
            التأكد أن الموعد لا يتجاوز
            وقت إغلاق الملعب.
        */

        const {
            open,
            close
        } =
            getOperatingPeriod();


        const startTimeline =
            timelineMinutes(
                selectedSlot.start
            );


        let endTimeline =
            timelineMinutes(
                selectedSlot.end
            );


        if(
            endTimeline <=
            startTimeline
        ){

            endTimeline +=
                1440;

        }


        if(
            startTimeline < open ||
            endTimeline > close
        ){

            showMessage(
                "الموعد يتجاوز وقت إغلاق الملعب.",
                true
            );


            await renderSlots();

            return;

        }


        /*
            إعادة حساب السعر.
        */

        const price =
            priceFor(
                selectedSlot.start,
                selectedSlot.duration
            );


        showMessage(
            "جاري تسجيل الحجز..."
        );


        const bookingData = {

            customer_name:
                name,

            customer_phone:
                phone,

            booking_date:
                dateInput.value,

            start_time:
                selectedSlot.start,

            end_time:
                selectedSlot.end,

            duration_minutes:
                selectedSlot.duration,

            price:
                price,

            booking_type:
                type,

            weekly_end_date:
                endDate,

            status:
                "pending"

        };


        const {
            error
        } =
            await supabaseClient
                .from("bookings")
                .insert(
                    bookingData
                );


        if(error){

            console.error(
                "Booking insert error:",
                error
            );


            showMessage(
                "حدث خطأ أثناء تسجيل الحجز: " +
                error.message,
                true
            );


            return;

        }


        showMessage(
            "تم تسجيل طلب الحجز بنجاح ✅ سيتم التواصل معك لتأكيد الموعد."
        );


        /*
            إرسال واتساب للمالك.
        */

        sendWhatsApp({
            ...bookingData
        });


        /*
            تنظيف النموذج.
        */

        bookingForm.reset();


        selectedSlot =
            null;


        selectedSummary
            .classList
            .add("hidden");


        /*
            إعادة تحميل المواعيد.
        */

        await renderSlots();

    }
);


// ================= WHATSAPP =================

function sendWhatsApp(
    booking
){

    if(!booking)
        return;


    /*
        حاليًا الإرسال للمالك الأول.
        لو عايز نرسل للاثنين لاحقًا
        نقدر نفتح الرابطين.
    */

    const owner =
        settings.ownerOne ||
        settings.ownerTwo ||
        "";


    if(!owner){

        console.warn(
            "No owner WhatsApp number configured."
        );

        return;

    }


    const cleanOwner =
        String(owner)
            .replace(
                /\D/g,
                ""
            );


    if(!cleanOwner){

        console.warn(
            "Invalid owner WhatsApp number."
        );

        return;

    }


    const typeText =
        booking.booking_type === "weekly"
            ?
            "حجز أسبوعي متكرر"
            :
            "حجز لمرة واحدة";


    const durationText =
        Number(
            booking.duration_minutes
        ) === 60

        ?

        "ساعة"

        :

        Number(
            booking.duration_minutes
        ) === 90

        ?

        "ساعة ونصف"

        :

        "ساعتان";


    const message =

        `⚽ *طلب حجز جديد - ملعب العزيمة 14*` +

        `\n\n` +

        `👤 الاسم: ${booking.customer_name}` +

        `\n📱 الموبايل: ${booking.customer_phone}` +

        `\n📅 التاريخ: ${dateLabel(
            booking.booking_date
        )}` +

        `\n⏰ الموعد: ${minutesToTime(
            timeToMinutes(
                booking.start_time
            )
        )} - ${minutesToTime(
            timeToMinutes(
                booking.end_time
            )
        )}` +

        `\n⏱️ المدة: ${durationText}` +

        `\n💰 السعر: ${booking.price} جنيه` +

        `\n📌 النوع: ${typeText}` +

        (
            booking.booking_type === "weekly"

            ?

            `\n🔄 ينتهي في: ${dateLabel(
                booking.weekly_end_date
            )}`

            :

            ""
        ) +

        `\n\n🟡 الحالة: في انتظار التأكيد`;


    const url =
        "https://wa.me/" +
        cleanOwner +
        "?text=" +
        encodeURIComponent(
            message
        );


    window.open(
        url,
        "_blank"
    );

}


// ================= START =================

async function init(){

    showMessage(
        "جاري تحميل المواعيد..."
    );


    await loadSettings();


    await renderSlots();


    if(
        messageEl &&
        messageEl.textContent ===
        "جاري تحميل المواعيد..."
    ){

        messageEl.classList
            .add("hidden");

    }

}


init();

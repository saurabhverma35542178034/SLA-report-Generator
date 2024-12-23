let ticketData = [];

document.getElementById('fileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            ticketData = XLSX.utils.sheet_to_json(worksheet);

            console.log("Raw ticketData: ", ticketData);
            
            
            populateFilters();
        };
        reader.readAsArrayBuffer(file);
    }
});

function populateFilters() {
    const types = new Set();
    const slaComplianceSet = new Set();

    ticketData.forEach(ticket => {
        if (ticket.Type) {
            types.add(ticket.Type);
        }
        if (ticket["SLA Compliance"]) {
            slaComplianceSet.add(ticket["SLA Compliance"]);
        }
    });

    
    const typeSelect = document.getElementById("typeFilter");
    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });

    
    const slaComplianceSelect = document.getElementById("slaComplianceFilter");
    slaComplianceSet.forEach(compliance => {
        const option = document.createElement("option");
        option.value = compliance;
        option.textContent = compliance;
        slaComplianceSelect.appendChild(option);
    });
}

function generateReport() {
    if (!ticketData.length) {
        alert("Please upload an Excel file first.");
        return;
    }

    const slaTimes = {
        "Question": 2,
        "Incident": 4,
        "Bug": 10,
        "Data Extraction Request": 5,
        "Feature Request": 30,
        "User Error": 5
    };

    let withinSLA = 0;
    let exceededSLA = 0;
    let totalTickets = ticketData.length;

    
    let ticketTypeSLA = {};

    ticketData.forEach(ticket => {
        const createdTimeStr = (ticket["Created time"] || "").toString().trim();  
        const resolvedTimeStr = (ticket["Resolved time"] || "").toString().trim();
        const closedTimeStr = (ticket["Closed time"] || "").toString().trim();

        const createdTime = parseDayMonthYear(createdTimeStr);
        const resolvedTime = parseDayMonthYear(resolvedTimeStr);
        const closedTime = parseDayMonthYear(closedTimeStr);

        let slaDays = slaTimes[ticket.Type] || null;

        let slaBreachDate = null;

        function calculateTimeDifferenceInDays(startDate, endDate) {
            const timeDifference = endDate - startDate;
            return Math.floor(timeDifference / (1000 * 60 * 60 * 24)); 
        }

        function calculateSlaBreachDate(createdDate, slaDays) {
            if (createdDate && slaDays !== null) {
                const breachDate = new Date(createdDate);
                breachDate.setDate(breachDate.getDate() + slaDays); 
                return breachDate;
            }
            return null;
        }

        if (slaDays === null) {
            ticket["SLA Breach Date"] = "No SLA defined for this";
            ticket["SLA Compliance"] = "No SLA defined for this";
        } else {
            slaBreachDate = calculateSlaBreachDate(createdTime, slaDays);

            if (createdTime) {
                
                if (!resolvedTime && !closedTime) {
                    const currentDate = new Date();
                    const daysToResolve = calculateTimeDifferenceInDays(createdTime, currentDate);

                    ticket["SLA Breach Date"] = slaBreachDate ? formatDate(slaBreachDate) : "N/A";
                    ticket["SLA Compliance"] = daysToResolve <= slaDays ? "Within SLA" : "Exceeds SLA";
                } else {
                    
                    let daysToResolve = 0;
                    if (resolvedTime) {
                        daysToResolve = calculateTimeDifferenceInDays(createdTime, resolvedTime);
                    } else if (closedTime) {
                        daysToResolve = calculateTimeDifferenceInDays(createdTime, closedTime);
                    }

                    ticket["SLA Breach Date"] = slaBreachDate ? formatDate(slaBreachDate) : "N/A";
                    ticket["SLA Compliance"] = resolvedTime || closedTime
                        ? (daysToResolve <= slaDays ? "Within SLA" : "Exceeds SLA")
                        : "No Resolution";
                }

                if (ticket["SLA Compliance"] === "Within SLA") {
                    withinSLA++;
                } else if (ticket["SLA Compliance"] === "Exceeds SLA") {
                    exceededSLA++;
                }
            } else {
                ticket["SLA Compliance"] = "No Created Time";
                ticket["SLA Breach Date"] = "No Created Time";
            }
        }

        
        if (!ticketTypeSLA[ticket.Type]) {
            ticketTypeSLA[ticket.Type] = { within: 0, exceeded: 0 };
        }

        if (ticket["SLA Compliance"] === "Within SLA") {
            ticketTypeSLA[ticket.Type].within++;
        } else if (ticket["SLA Compliance"] === "Exceeds SLA") {
            ticketTypeSLA[ticket.Type].exceeded++;
        }
    });

    let slaPercentage = (withinSLA / totalTickets) * 100;

    
    const typeFilter = document.getElementById("typeFilter").value;
    const slaComplianceFilter = document.getElementById("slaComplianceFilter").value;

    const filteredTicketData = ticketData.filter(ticket => {
        const typeMatch = typeFilter ? ticket.Type === typeFilter : true;
        const slaComplianceMatch = slaComplianceFilter ? ticket["SLA Compliance"] === slaComplianceFilter : true;
        return typeMatch && slaComplianceMatch;
    });

    let html = `<table>
        <tr>
            <th>Ticket ID</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Type</th>
            <th>Created Time</th>
            <th>Resolved Time</th>
            <th>Closed Time</th>
            <th>SLA Breach Date</th>
            <th>SLA Compliance</th>
        </tr>`;

    filteredTicketData.forEach(ticket => {
        html += `<tr>
            <td>${ticket["Ticket ID"]}</td>
            <td>${ticket.Subject}</td>
            <td>${ticket.Status}</td>
            <td>${ticket.Priority}</td>
            <td>${ticket.Type || "No Type"}</td>
            <td>${ticket["Created time"] || ''}</td>
            <td>${ticket["Resolved time"] || ''}</td>
            <td>${ticket["Closed time"] || ''}</td>
            <td>${ticket["SLA Breach Date"]}</td>
            <td>${ticket["SLA Compliance"]}</td>
        </tr>`;
    });

    html += `</table><br><strong><h2 id="sladata">Overall SLA Compliance: ${slaPercentage.toFixed(2)}%</h2></strong>`;

    
    html += `<h2>SLA Compliance by Ticket Type:</h2>`;
    html += `<table>
        <tr>
            <th>Ticket Type</th>
            <th>Within SLA</th>
            <th>Exceeded SLA</th>
        </tr>`;
    for (const [type, counts] of Object.entries(ticketTypeSLA)) {
        html += `<tr>
            <td>${type}</td>
            <td>${counts.within}</td>
            <td>${counts.exceeded}</td>
        </tr>`;
    }
    html += `</table>`;

    document.getElementById("report").innerHTML = html;
}

function applyFilters() {
    generateReport();
}

function parseDayMonthYear(value) {
    if (value) {
        const parts = value.split("-");
        if (parts.length === 3) {
            const day = parts[0];
            const month = parts[1] - 1; 
            const year = parts[2];
            return new Date(year, month, day);  
        }
    }
    return null;
}

function formatDate(date) {
    if (date) {
        const day = ("0" + date.getDate()).slice(-2); 
        const month = ("0" + (date.getMonth() + 1)).slice(-2);  
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }
    return null;
}
